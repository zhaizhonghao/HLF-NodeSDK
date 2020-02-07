/**
 * Demonstrates the use of Channel class instance for querying the channel
 */
const fs = require('fs');
const Client = require('fabric-client');

const asn = require('asn1.js')
var sha = require('js-sha256');

// Constants for profile, wallet & user
const CONNECTION_PROFILE_PATH = './profiles/dev-connection.yaml'
// Client section configuration
const ACME_CLIENT_CONNECTION_PROFILE_PATH = './profiles/acme-client.yaml'
const BUDGET_CLIENT_CONNECTION_PROFILE_PATH = './profiles/budget-client.yaml'

// Org & User
//const ORG_NAME = 'acme'
const USER_NAME = 'Admin'   // Non admin identity will lead to 'access denied' try User1
//const CHANNEL_NAME = 'airlinechannel'


// Variable to hold the client
var client = {}
// Variable to hold the channel
var channel = {}

exports.queryBlockHeight = async function(orgName,channelName){
    await setup(orgName,channelName);
    // Gets the info on the blockchain
    let info = await channel.queryInfo();
    const blockHeight = parseInt(info.height.low);
    return {blockHeight:blockHeight};
};

exports.queryGenesisBlockHash = async function(orgName,channelName){
    await setup(orgName,channelName);
    let genesis = await channel.getGenesisBlock();
    //console.log(genesis);
    return {genesisBlockHash:genesis.header.data_hash};
};

exports.queryBlockByHeight = async function(orgName,channelName,blockHeight){
    await setup(orgName,channelName);
    let block =await channel.queryBlock(blockHeight - 1);
    let transactions = [];
    block.data.data.forEach(transaction => {
        let transactionInfo = {
            transactionID : transaction.payload.header.channel_header.tx_id,
            creatorID : transaction.payload.header.signature_header.creator.Mspid
        }
        transactions.push(transactionInfo);
      })
    let blockInfo = {
        blockNumber : block.header.number,
        blockHash : calculateBlockHash(block.header),
        preBlockHash : block.header.previous_hash,
        dataHash : block.header.data_hash,
        transactionsCount : block.data.data.length,
        transactions : transactions
    };
    //console.log(blockInfo);
    return blockInfo;
};

exports.queryTransactionById = async function(orgName,channelName,txId){
    await setup(orgName,channelName);
    let transaction = await channel.queryTransaction(txId);
    let transactionInfo = {
        txId : transaction.transactionEnvelope.payload.header.channel_header.tx_id,
        channelId : transaction.transactionEnvelope.payload.header.channel_header.channel_id,
        timestamp : transaction.transactionEnvelope.payload.header.channel_header.timestamp,
        type : transaction.transactionEnvelope.payload.header.channel_header.typeString
    }
    return transactionInfo;
}

/**
 * Get the information on instantiated chaincode
 */
exports.queryChaincodeInfo = async function(orgName,channelName){
    await setup(orgName,channelName);
    let chaincodes = await channel.queryInstantiatedChaincodes();
    let chaincodesInfo = []
    for (var i=0; i<chaincodes.chaincodes.length; i++){
        let chaincode = {
            chaincodeName : chaincodes.chaincodes[i].name,
            version : chaincodes.chaincodes[i].version
        }
        chaincodesInfo.push(chaincode);
    }
    return chaincodesInfo;
}

/**
 * Demonstrates the use of query by chaincode
 */
async function queryERC20(){
    // Execute the query
    chaincodes = await channel.queryByChaincode({
        chaincodeId: 'erc20',
        fcn: 'balanceOf',
        args: ['sam']
    })

    console.log(chaincodes[0].toString("utf8"))
}

async function setup(orgName,channelName){
    client = await setupClient(orgName);
    channel = await setupChannel(channelName);
}

/**
 * Creates an instance of the Channel class
 */
async function setupChannel(channelName) {
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

/**
 * Used for calculating hash for block received with channel.queryBlock
 * @param {*} header 
 */
function calculateBlockHash(header) {
    let headerAsn = asn.define('headerAsn', function () {
        this.seq().obj(
            this.key('Number').int(),
            this.key('PreviousHash').octstr(),
            this.key('DataHash').octstr()
        );
    });

    let output = headerAsn.encode({
        Number: parseInt(header.number),
        PreviousHash: Buffer.from(header.previous_hash, 'hex'),
        DataHash: Buffer.from(header.data_hash, 'hex')
    }, 'der');

    let hash = sha.sha256(output);
    return hash;
}
