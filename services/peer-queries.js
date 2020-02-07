/**
 * Demonstrates the use of client API for carrying out the admin tasks
 * Dependency: The dev environment MUST be up
 */

const fs = require('fs');
const Client = require('fabric-client');

// Constants for profile, wallet & user
const CONNECTION_PROFILE_PATH = './profiles/dev-connection.yaml'
// Client section configuration
const ACME_CLIENT_CONNECTION_PROFILE_PATH = './profiles/acme-client.yaml'
const BUDGET_CLIENT_CONNECTION_PROFILE_PATH = './profiles/budget-client.yaml'

// Org & User
const ORG_NAME = 'budget'
const USER_NAME = 'Admin'   // Non admin identity will lead to 'access denied' try User1
const PEER_NAME = 'budget-peer1.budget.com'

// Variable to hold the client
var client = {}
/**
 * Gathers and prints the specified peer's info
 */
exports.getPeerInfo = async function(org,peerName) {
    // Initialize the credential store
    client = await setupClient(org)
    
    // Gets the named peer from the connection profile
    // https://fabric-sdk-node.github.io/master/Peer.html
    // A peer may be retrieved or even created
    let peer = await client.getPeer(peerName)
    
    // console.log(peer.getCharacteristics())
    //console.log(`Peer Name=${peer.getName()}  URL=${peer.getUrl()}`)

    // Get the list of channels that peer has joined
    let chans = await client.queryChannels(peer, true)
    let channelsJoined = []
    //console.log("Channels joined:")
    for (var i=0; i<chans.channels.length; i++){
        //console.log(`\t${i+1}. ${chans.channels[i].channel_id}`)
        channelsJoined.push(chans.channels[i].channel_id)
    }

    // Get the list of chaincodes installed on the peer
    let chaincodes = await client.queryInstalledChaincodes(peer, true)
    // console.log(chaincodes)
    //console.log("Chaincode installed:")
    let chaincodeInstalled = []
    for (var i=0; i<chaincodes.chaincodes.length; i++){
        //console.log(`\t${i+1}. name=${chaincodes.chaincodes[i].name} version=${chaincodes.chaincodes[i].version}`)
        let chaincode = {
            name : chaincodes.chaincodes[i].name,
            version : chaincodes.chaincodes[i].version
        }
        chaincodeInstalled.push(chaincode);
    }

    // Get the list of peers that are connected for gossip
    // https://fabric-sdk-node.github.io/master/global.html#PeerQueryRequest
    // A request needs to be sent to the target peer
    let peerQueryRequest = {
        target: peer,
        useAdmin: true
    }
    // Send the query request to peer
    let peerQueryResponse = await client.queryPeers(peerQueryRequest)
    // console.log(JSON.stringify(peerQueryResponse))
    //console.log("Gossip network:")
    let network = []
    if (peerQueryResponse.local_peers.AcmeMSP && peerQueryResponse.local_peers.AcmeMSP.peers.length > 0){
        //console.log(`\tAcmeMSP: ${peerQueryResponse.local_peers.AcmeMSP.peers[0].endpoint}`)
        network.push(peerQueryResponse.local_peers.AcmeMSP.peers[0].endpoint)
    }
    if (peerQueryResponse.local_peers.BudgetMSP && peerQueryResponse.local_peers.BudgetMSP.peers.length > 0){
        //console.log(`\tBudgetMSP: ${peerQueryResponse.local_peers.BudgetMSP.peers[0].endpoint}`)
        network.push(peerQueryResponse.local_peers.BudgetMSP.peers[0].endpoint)
    }

    let peerInfo ={
        name : peer.getName(),
        url : peer.getUrl(),
        channelsJoined : channelsJoined,
        chaincodeInstalled : chaincodeInstalled,
        network : network
    }

    return peerInfo;

}



/**
 * Initialize the file system credentials store
 * 1. Creates the instance of client using <static> loadFromConfig
 * 2. Loads the client connection profile based on org name
 * 3. Initializes the credential store
 * 4. Loads the user from credential store
 * 5. Sets the user on credstore and returns it
 */
async function setupClient(org) {

    // setup the instance
    const client = Client.loadFromConfig(CONNECTION_PROFILE_PATH)

    // setup the client part
    if (org == 'acme') {
        client.loadFromConfig(ACME_CLIENT_CONNECTION_PROFILE_PATH)
    } else if (org == 'budget') {
        client.loadFromConfig(BUDGET_CLIENT_CONNECTION_PROFILE_PATH)
    } else {
        console.log("Invalid Org: ", org)
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