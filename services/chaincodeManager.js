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
exports.instantiateChaincode = async function(){
    
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