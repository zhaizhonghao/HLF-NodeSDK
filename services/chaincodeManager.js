/**
 * Demonstrates the setup of the credential store
 */
const fs = require('fs');
const Client = require('fabric-client');
const path = require('path');
var util = require('util');

// Constants for profile, wallet & user
const CONNECTION_PROFILE_PATH = './profiles/dev-connection.yaml'

// Client section configuration
const ACME_CLIENT_CONNECTION_PROFILE_PATH = './profiles/acme-client.yaml'
const BUDGET_CLIENT_CONNECTION_PROFILE_PATH = './profiles/budget-client.yaml'

const USER_NAME = 'Admin'   // Non admin identity will lead to 'access denied' try User1
const CHANNEL_CONFIG_PATH = '../../network/config/mychannel.tx'

exports.createChannel = async function(orgName,channelName,channelConfigPath){
    try {

        let client = await setupClient(orgName);

        // read in the envelope for the channel config raw bytes
        var envelope = fs.readFileSync(path.join(__dirname, channelConfigPath));
    
        // extract the channel config bytes from the envelope to be signed
        var channelConfig = client.extractChannelConfig(envelope);
    
        //Acting as a client in the given organization provided with "orgName" param
        // sign the channel config bytes as "endorsement", this is required by
        // the orderer's channel creation policy
        // this will use the admin identity assigned to the client when the connection profile was loaded
        let signature = client.signChannelConfig(channelConfig);
    
        let request = {
            config: channelConfig,
            signatures: [signature],
            name: channelName,
            txId: client.newTransactionID(true) // get an admin based transactionID
        };
    
        // send to orderer
        var response = await client.createChannel(request);
        console.log(response);
    
        if (response && response.status === 'SUCCESS') {
            console.log('Successfully created the channel.');
            let response = {
                success: true,
                message: 'Channel \'' + channelName + '\' created Successfully'
            };
            return response;
        } else {
            console.log('\n!!!!!!!!! Failed to create the channel \'' + channelName +
                '\' !!!!!!!!!\n\n');
            throw new Error('Failed to create the channel \'' + channelName + '\'');
        }
        
    } catch (error) {
        console.log('Failed to initialize the channel: ' + error.stack ? error.stack :    error);
        throw new Error('Failed to initialize the channel: ' + error.toString());
    }
};

exports.joinChannel = async function(orgName,channelName,peers){
    var error_message = null;
    var all_eventhubs = [];
    try {
        let client = await setupClient(orgName);
        var channel = client.getChannel(channelName);
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', channelName);
            console.log(message);
            throw new Error(message);
        }
        // next step is to get the genesis_block from the orderer,
        // the starting point for the channel that we want to join
        let request = {
            txId :     client.newTransactionID(true) //get an admin based transactionID
        };
        //Get the genesis block
        let genesis_block = await channel.getGenesisBlock(request);

        // tell each peer to join and wait 10 seconds
        // for the channel to be created on each peer
        var promises = [];
        promises.push(new Promise(resolve => setTimeout(resolve, 10000)));

        let targets = []
        for (let index = 0; index < peers.length; index++) {
            console.log(peers[index])
            let peer = client.newPeer(peers[index]);
            targets.push(peer);
        }
        let join_request = {
            targets: targets, //using the peer names which only is allowed when a connection profile is loaded
            txId: client.newTransactionID(true), //get an admin based transactionID
            block: genesis_block
        };

        let join_promise = channel.joinChannel(join_request);
        promises.push(join_promise);
        let results = await Promise.all(promises);
        console.log(util.format('Join Channel R E S P O N S E : %j', results));

        // lets check the results of sending to the peers which is
        // last in the results array
        let peers_results = results.pop();
        // then each peer results
        for(let i in peers_results) {
            let peer_result = peers_results[i];
            if(peer_result.response && peer_result.response.status == 200) {
                console.log('Successfully joined peer to the channel %s',channelName);
            } else {
                let message = util.format('Failed to joined peer to the channel %s',channelName);
                error_message = message;
                console.log(message);
            }
        }
    } catch (error) {
        console.log('Failed to join channel due to error: ' + error.stack ? error.stack : error);
        error_message = error.toString();
    }

    // need to shutdown open event streams
    all_eventhubs.forEach((eh) => {
        eh.disconnect();
    });

    if (!error_message) {
        let message = util.format(
            'Successfully joined peers in organization %s to the channel:%s',
            orgName, channelName);
        console.log(message);
        // build a response to send back to the REST caller
        let response = {
            success: true,
            message: message
        };
        return response;
    } else {
        let message = util.format('Failed to join all peers to channel. cause:%s',error_message);
        console.log(message);
        throw new Error(message);
    }
};

//To install the chaincode in $GOPATH/src/chaincodePath
exports.installChaincode = async function(orgName,peers,chaincodePath,chaincodeId,chaincodeVersion,channelNames,chaincodeType){
    let client = await setupClient(orgName);
    let targets = []
    for (let index = 0; index < peers.length; index++) {
        console.log(peers[index])
        let peer = client.newPeer(peers[index]);
        targets.push(peer);
    }
    var chaincodeInstallRequest = {
        targets : targets,
        chaincodePath: chaincodePath,
        chaincodeId: chaincodeId,
        chaincodeVersion: chaincodeVersion,
        channelNames : channelNames,
        chaincodeType: chaincodeType
    };
    //console.log('GOPATH',process.env.GOPATH);
    try {
        let result = await client.installChaincode(chaincodeInstallRequest);
        //TODO It lacks the process about handlering the proposal response
        console.log(result);
        return result;
    } catch (error) {
        console.log(error);
        return error;
    }
};

//To instantiate the installed chaincode
exports.instantiateChaincode = async function(orgName,peers,chaincodeId,chaincodeVersion,channelNames,chaincodeType,args){
    //setup the channel
    let client = await setupClient(orgName);
    let channel = await setupChannel(client,channelNames);
    let error_message = null;

    //generate a transaction ID
    let tx_id = client.newTransactionID(true);


    // will need the transaction ID string for the event registration later
    var deployId = tx_id.getTransactionID();
    //create the ChaincodeInstantiateUpgradeRequest object
    let targets = []
    for (let index = 0; index < peers.length; index++) {
        console.log(peers[index])
        let peer = client.newPeer(peers[index]);
        targets.push(peer);
    }
    var request = {
        targets : targets,
        chaincodeId: chaincodeId,
        chaincodeType: chaincodeType,
        chaincodeVersion: chaincodeVersion,
        args: args,
        txId: tx_id
    };

    //to send the chaincode instantiate proposal and set the timeout to be 60000 miliseconds
    let results = await channel.sendInstantiateProposal(request, 60000);
    //the returned object has both the endorsement results and the actual proposal, the proposal will
    //be need later when we send a transaction to the orderer
    var proposalResponses = results[0];
    var proposal = results[1];
    //to check the responses if they are all good, if yes, they will then include signatures required to be committed
    let allGood = true;
    console.log(proposalResponses);
    console.log(proposal);
    for (var i in proposalResponses) {
        let oneGood = false;
        if (proposalResponses && proposalResponses[i].response &&
            proposalResponses[i].response.status === 200) {
            oneGood = true;
            console.log('instantiate proposal was good');
        } else {
            console.log('instantiate proposal was bad');
        }
        allGood = allGood & oneGood;
    }
    console.log(allGood);
    //TODO
    if (allGood) {
        //wait for the channel-based event hub to tell us that
        //the instantiate transaction was committed on the peer
        let promises = [];
        let eventHubs = channel.getChannelEventHubsForOrg();
        console.log(`found ${eventHubs.length} for this organization ${orgName}`);
        eventHubs.forEach((eh) => {
            let instantiateEventPromise = new Promise((resolve, reject) => {
                console.log('instantiateEventPromise - setting up event');
                let event_timeout = setTimeout(() => {
                    let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
                    console.log(message);
                    eh.disconnect();
                }, 60000);
                eh.registerTxEvent(deployId, (tx, code, block_num) => {
                    console.log('The chaincode instantiate transaction has been committed on peer %s',eh.getPeerAddr());
                    console.log('Transaction %s has status of %s in blocl %s', tx, code, block_num);
                    clearTimeout(event_timeout);

                    if (code !== 'VALID') {
                        let message = util.format('The chaincode instantiate transaction was invalid, code:%s',code);
                        console.log(message);
                        reject(new Error(message));
                    } else {
                        let message = 'The chaincode instantiate transaction was valid.';
                        console.log(message);
                        resolve(message);
                    }
                }, (err) => {
                    clearTimeout(event_timeout);
                    console.log(err);
                    reject(err);
                },
                    // the default for 'unregister' is true for transaction listeners
                    // so no real need to set here, however for 'disconnect'
                    // the default is false as most event hubs are long running
                    // in this use case we are using it only once
                    {unregister: true, disconnect: true}
                );
                eh.connect();
            });
            promises.push(instantiateEventPromise);
        });
        var orderer_request = {
            txId: tx_id, // must include the transaction id so that the outbound
                         // transaction to the orderer will be signed by the admin
                         // id as was the proposal above, notice that transactionID
                         // generated above was based on the admin id not the current
                         // user assigned to the 'client' instance.
            proposalResponses: proposalResponses,
            proposal: proposal
        };
        var sendPromise = channel.sendTransaction(orderer_request);
        // put the send to the orderer last so that the events get registered and
        // are ready for the orderering and committing
        promises.push(sendPromise);
        let results = await Promise.all(promises);
        console.log(util.format('------->>> R E S P O N S E : %j', results));
        let response = results.pop(); //  orderer results are last in the results
        if (response.status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
            console.log(error_message);
        }

        // now see what each of the event hubs reported
        for(let i in results) {
            let event_hub_result = results[i];
            let event_hub = eventHubs[i];
            console.log('Event results for event hub :%s',event_hub.getPeerAddr());
            if(typeof event_hub_result === 'string') {
                console.log(event_hub_result);
            } else {
                if(!error_message) error_message = event_hub_result.toString();
                console.log(event_hub_result.toString());
            }
        }               
    }else {
        error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
        console.log(error_message);
    }

    if (!error_message) {
        let message = util.format(
            'Successfully instantiate chaingcode in organization %s to the channel \'%s\'',
            orgName, channelNames);
        console.log(message);
        // build a response to send back to the REST caller
        let response = {
            success: true,
            message: message
        };
        return response;
    } else {
        let message = util.format('Failed to instantiate. cause:%s',error_message);
        console.log(message);
        return message;
    }
};

//To upgrade the installed chaincode
exports.upgradeChannel = async function(orgName,peers,chaincodeId,chaincodeVersion,channelNames,chaincodeType,args){
    //setup the channel
    let client = await setupClient(orgName);
    let channel = await setupChannel(client,channelNames);
    let error_message = null;

    //generate a transaction ID
    let tx_id = client.newTransactionID(true);


    // will need the transaction ID string for the event registration later
    var deployId = tx_id.getTransactionID();
    //create the ChaincodeInstantiateUpgradeRequest object
    let targets = []
    for (let index = 0; index < peers.length; index++) {
        console.log(peers[index])
        let peer = client.newPeer(peers[index]);
        targets.push(peer);
    }
    var request = {
        targets : targets,
        chaincodeId: chaincodeId,
        chaincodeType: chaincodeType,
        chaincodeVersion: chaincodeVersion,
        args: args,
        txId: tx_id
    };

    //to send the chaincode upgrade proposal and set the timeout to be 60000 miliseconds
    let results = await channel.sendUpgradeProposal(request, 60000);
    //the returned object has both the endorsement results and the actual proposal, the proposal will
    //be need later when we send a transaction to the orderer
    var proposalResponses = results[0];
    var proposal = results[1];
    //to check the responses if they are all good, if yes, they will then include signatures required to be committed
    let allGood = true;
    console.log(proposalResponses);
    console.log(proposal);
    for (var i in proposalResponses) {
        let oneGood = false;
        if (proposalResponses && proposalResponses[i].response &&
            proposalResponses[i].response.status === 200) {
            oneGood = true;
            console.log('instantiate proposal was good');
        } else {
            console.log('instantiate proposal was bad');
        }
        allGood = allGood & oneGood;
    }
    console.log(allGood);
    //TODO
    if (allGood) {
        //wait for the channel-based event hub to tell us that
        //the upgrade transaction was committed on the peer
        let promises = [];
        let eventHubs = channel.getChannelEventHubsForOrg();
        console.log(`found ${eventHubs.length} for this organization ${orgName}`);
        eventHubs.forEach((eh) => {
            let instantiateEventPromise = new Promise((resolve, reject) => {
                console.log('upgradeEventPromise - setting up event');
                let event_timeout = setTimeout(() => {
                    let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
                    console.log(message);
                    eh.disconnect();
                }, 60000);
                eh.registerTxEvent(deployId, (tx, code, block_num) => {
                    console.log('The chaincode upgrade transaction has been committed on peer %s',eh.getPeerAddr());
                    console.log('Transaction %s has status of %s in blocl %s', tx, code, block_num);
                    clearTimeout(event_timeout);

                    if (code !== 'VALID') {
                        let message = util.format('The chaincode upgrade transaction was invalid, code:%s',code);
                        console.log(message);
                        reject(new Error(message));
                    } else {
                        let message = 'The chaincode upgrade transaction was valid.';
                        console.log(message);
                        resolve(message);
                    }
                }, (err) => {
                    clearTimeout(event_timeout);
                    console.log(err);
                    reject(err);
                },
                    // the default for 'unregister' is true for transaction listeners
                    // so no real need to set here, however for 'disconnect'
                    // the default is false as most event hubs are long running
                    // in this use case we are using it only once
                    {unregister: true, disconnect: true}
                );
                eh.connect();
            });
            promises.push(instantiateEventPromise);
        });
        var orderer_request = {
            txId: tx_id, // must include the transaction id so that the outbound
                         // transaction to the orderer will be signed by the admin
                         // id as was the proposal above, notice that transactionID
                         // generated above was based on the admin id not the current
                         // user assigned to the 'client' instance.
            proposalResponses: proposalResponses,
            proposal: proposal
        };
        var sendPromise = channel.sendTransaction(orderer_request);
        // put the send to the orderer last so that the events get registered and
        // are ready for the orderering and committing
        promises.push(sendPromise);
        let results = await Promise.all(promises);
        console.log(util.format('------->>> R E S P O N S E : %j', results));
        let response = results.pop(); //  orderer results are last in the results
        if (response.status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
            console.log(error_message);
        }

        // now see what each of the event hubs reported
        for(let i in results) {
            let event_hub_result = results[i];
            let event_hub = eventHubs[i];
            console.log('Event results for event hub :%s',event_hub.getPeerAddr());
            if(typeof event_hub_result === 'string') {
                console.log(event_hub_result);
            } else {
                if(!error_message) error_message = event_hub_result.toString();
                console.log(event_hub_result.toString());
            }
        }               
    }else {
        error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
        console.log(error_message);
    }

    if (!error_message) {
        let message = util.format(
            'Successfully upgrade chaingcode in organization %s to the channel \'%s\'',
            orgName, channelNames);
        console.log(message);
        // build a response to send back to the REST caller
        let response = {
            success: true,
            message: message
        };
        return response;
    } else {
        let message = util.format('Failed to upgrade. cause:%s',error_message);
        console.log(message);
        return message;
    }
};

/**
 * Initialize the file system credentials store
 * 1. Creates the instance of client using <static> loadFromConfig
 * 2. Loads the client connection profile based on org name
 * 3. Initializes the credential store
 * 4. Loads the user from credential store
 * 5. Sets the user on client instance and returns it
 */
async function setupClient(orgName) {

    // setup the instance
    const client = Client.loadFromConfig(CONNECTION_PROFILE_PATH)

    // setup the client part
    if (orgName == 'acme') {
        client.loadFromConfig(ACME_CLIENT_CONNECTION_PROFILE_PATH)
    } else if (orgName == 'budget') {
        client.loadFromConfig(BUDGET_CLIENT_CONNECTION_PROFILE_PATH)
    } else {
        console.log("Invalid Org: ", orgName)
        process.exit(1)
    }

    // Call the function for initializing the credentials store on file system
    await client.initCredentialStores()
        .then((done) => {
            console.log("initCredentialStore(): ", done)
        })

    let userContext = await client.loadUserFromStateStore(USER_NAME)
    if (userContext == null) {
        console.log("User NOT found in credstore: ", USER_NAME)
        process.exit(1)
    }

    // set the user context on client
    client.setUserContext(userContext, true)

    return client
}

async function setupChannel(client,channelName) {
    try {
        // Get the Channel class instance from client
        channel = await client.getChannel(channelName, true)
    } catch (e) {
        console.log("Could NOT create channel: ", channelName)
        process.exit(1)
    }
    console.log("Created channel object.")

    return channel
}