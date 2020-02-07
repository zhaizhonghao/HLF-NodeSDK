/**
 * Demonstrates the setup of the credential store
 */
const fs = require('fs');
const Client = require('fabric-client');
const path = require('path');

// Constants for profile, wallet & user
const CONNECTION_PROFILE_PATH = './profiles/dev-connection.yaml'

// Client section configuration
const ACME_CLIENT_CONNECTION_PROFILE_PATH = './profiles/acme-client.yaml'
const BUDGET_CLIENT_CONNECTION_PROFILE_PATH = './profiles/budget-client.yaml'

const USER_NAME = 'Admin'   // Non admin identity will lead to 'access denied' try User1
const CHAINCODE_PATH = path.resolve(__dirname, './chaincode/v1/token');

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
exports.instantiateChaincode = async function(orgName,peers,chaincodeId,chaincodeVersion,channelNames,chaincodeType,functionName,args){
    //setup the channel
    let client = await setupClient(orgName);
    let channel = await setupChannel(client,channelNames);

    //generate a transaction ID
    let tx_id = client.newTransactionID(true);
    //create the ChaincodeInstantiateUpgradeRequest object
    var request = {
        targets : peers,
        chaincodeId: chaincodeId,
        chaincodeType: chaincodeType,
        chaincodeVersion: chaincodeVersion,
        args: args,
        txId: tx_id
    };
    //to set the init function Name
    if (functionName)
        request.fcn = functionName;
    //to send the chaincode instantiate proposal and set the timeout to be 60000 miliseconds
    let results = await channel.sendInstantiateProposal(request, 60000);
    //the returned object has both the endorsement results and the actual proposal, the proposal will
    //be need later when we send a transaction to the orderer
    var proposalResponses = results[0];
    var proposal = results[1];
    //to check the responses if they are all good, if yes, they will then include signatures required to be committed
    let allGood = true;
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
    //TODO
    if (allGood) {
        //wait for the channel-based event hub to tell us that
        //the instantiate transaction was committed on the peer
        let promises = [];
        let eventHubs = channel.getChannelEventHubsForOrg();
        console.log(`found ${eventHubs.length} for this organization ${orgName}`);
        

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