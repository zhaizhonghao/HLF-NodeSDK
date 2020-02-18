/**
 * Author: Zhai Zhonghao
 * Description : Blockchain API
 * Created Date : 2020/02/03 
 */
const express = require('express');
const Joi = require('joi');
const PeerInfo = require('./services/peer-queries.js');
const CredStore = require('./services/cred-store.js');
const ChannelInfo = require('./services/channel-queries.js');
const Wallet = require('./services/wallet.js');
const Gateway = require('./services/gateway.js');
const ChaincodeManager = require('./services/chaincodeManager.js');

const app = express();
app.use(express.json());


app.get('/',(req,res)=>{
    res.send('Blockchain RESTful API');
});
/**
 * Using the low level sdk fabric-client
 */
//to init the cred-store to copy the pri/pub key into credstore subfold
app.post('/api/credStoreInit',async(req,res)=>{
    //check whether the request content is valid
    const schema = {
        org : Joi.string().min(3).required(),
        user:Joi.string().min(3).required()
    };
    const result = Joi.validate(req.body,schema);
    if(result.error){
        res.status(400).send(result.error);
    }
    //init TODO should provide the error handler
    await CredStore.initCredStore(req.body.org,req.body.user);
    res.send('cred store init!');
});

//to get the information about the peer in the network such as its name, url, joined channels and installed chaincode
app.get('/api/peerInfo/:org/:peerName',async (req,res)=>{
    let peerInfo = await PeerInfo.getPeerInfo(req.params.org,req.params.peerName);
    //TODO 
    if(!peerInfo) return res.status(404).send('The peer is not found');
    res.send(peerInfo);
});

//To get the height of the latest block
app.get('/api/channel/getLatestBlckHeight/:orgName/:channelName', async (req,res)=>{
    let blockHeight 
        = await ChannelInfo.queryBlockHeight(req.params.orgName,req.params.channelName);
    //TODO 
    if(!blockHeight) return res.status(404).send('The block is not found');
    res.send(blockHeight);
});

//To get the genesis block in the channel
app.get('/api/channel/getGenesisBlockHash/:orgName/:channelName',async (req,res)=>{
    let genesisBlockHash 
        = await ChannelInfo.queryGenesisBlockHash(req.params.orgName,req.params.channelName);
    //TODO 
    if(!genesisBlockHash) return res.status(404).send('The genesis block is not found');
    res.send(genesisBlockHash);
});

//To get the block information by block height
app.get('/api/channel/getBlockbyHeight/:orgName/:channelName/:height',async (req,res)=>{
    let blockInfo 
        = await ChannelInfo.queryBlockByHeight(req.params.orgName,req.params.channelName,req.params.height);
    //TODO 
    if(!blockInfo) return res.status(404).send('The block is not found');
    res.send(blockInfo);
});


//To the information about the chaincodes Instantiated in the channel
app.get('/api/channel/getChaincodesInfo/:orgName/:channelName',async(req,res)=>{
    let chaincodesInfo 
        = await ChannelInfo.queryChaincodeInfo(req.params.orgName,req.params.channelName);
    //TODO 
    if(!chaincodesInfo) return res.status(404).send('The chaincode instantiated is not found');
    res.send(chaincodesInfo);
});

//To the transaction by transaction Id
app.get('/api/channel/getTransactionById/:orgName/:channelName/:txId',async(req,res)=>{
    let transaction 
        = await ChannelInfo.queryTransactionById(req.params.orgName,req.params.channelName,req.params.txId);
    //TODO 
    if(!transaction) return res.status(404).send('The transaction is not found');
    res.send(transaction);

});

//To create the channel
app.post('/api/channel/createChannel', async (req,res)=>{
    try {
        let result = await ChaincodeManager.createChannel(req.body.orgName,req.body.channelName,req.body.channelConfigPath);
        //TODO 
        if(!result) return res.status(404).send('Fail to create the channel!');
        res.send(result);
    } catch (error) {
        return res.status(400).send('Fail to create the channel!');
    }
});

//To join the channel
app.post('/api/channel/joinChannel', async (req,res)=>{
    try {
        let result = await ChaincodeManager.joinChannel(req.body.orgName,req.body.channelName,req.body.peers);
        //TODO 
        if(!result) return res.status(404).send('Fail to join the channel!');
        res.send(result);
    } catch (error) {
        return res.status(400).send('Fail to join the channel!');
    }
});

//To install the chaincode which is placed in $GOPATH/src
app.post('/api/channel/installChaincode',async (req,res)=>{
    let result 
        = await ChaincodeManager
                .installChaincode(
                    req.body.orgName,
                    req.body.peers,
                    req.body.chaincodePath,
                    req.body.chaincodeId,
                    req.body.chaincodeVersion,
                    req.body.channelNames,
                    req.body.chaincodeType);    
    //TODO 
    if(!result) return res.status(404).send({result:'The transaction is not found'});
    res.send({result : 'chaincode installed!'});
});

//To instantiate the installed chaincode
app.post('/api/channel/instantiateChaincode',async (req,res)=>{
    let result 
        = await ChaincodeManager
                .instantiateChaincode(
                    req.body.orgName,
                    req.body.peers,
                    req.body.chaincodeId,
                    req.body.chaincodeVersion,
                    req.body.channelNames,
                    req.body.chaincodeType,
                    req.body.args);    
    //TODO 
    if(!result) return res.status(404).send({result:'The transaction is not found'});
    res.send({result : 'chaincode instantiated!'});    
});

//To upgrade the chaincode
app.post('/api/channel/upgradeChaincode',async (req,res)=>{
    let result 
        = await ChaincodeManager
                .upgradeChaincode(
                    req.body.orgName,
                    req.body.peers,
                    req.body.chaincodeId,
                    req.body.chaincodeVersion,
                    req.body.channelNames,
                    req.body.chaincodeType,
                    req.body.args);    
    //TODO 
    if(!result) return res.status(404).send({result:'The transaction is not found'});
    res.send({result : 'chaincode upgrade!'});    
});

/**
 * Using the high level sdk fabric-network
 */
//To create the wallet
app.post('/api/chaincode/addToWallet',async (req,res)=>{
    console.log(req.body.orgName);
    try {
        await Wallet.addToWallet(req.body.orgName,req.body.user);
    } catch (error) {
        res.status(400).send(error);
        console.log(error);
    }
    res.send('add the identity to the wallet successfully!');
});

//To list the wallet
app.get('/api/chaincode/listWallet',async (req,res)=>{
    let walletInfo = await Wallet.listIdentityCards();
    //TODO 
    if(!walletInfo) return res.status(404).send('There is no identity in the wallet!');
    res.send(walletInfo);
});

//To export the identityCard
app.get('/api/chaincode/exportWallet/:orgName/:user',async (req,res)=>{
    let identity = await Wallet.exportIdentity(req.params.orgName,req.params.user);
    //TODO 
    if(!identity) return res.status(404).send('There is no identity found !');
    res.send(identity);
});

//To query the chaincode
app.post('/api/chaincode/query',async (req,res)=>{
    //check whether the request content is valid
    const schema = {
        networkName : Joi.string().min(3).required(),
        chaincodeName : Joi.string().min(3).required(),
        funcName : Joi.string().min(3).required(),
        funcArgs : Joi.required()
    };
    const result = Joi.validate(req.body,schema);
    if(result.error){
        console.log(result.error);
        return res.status(400).send(result.error);
    }

    let answer 
        = await Gateway.queryContract(req.body.networkName,req.body.chaincodeName,req.body.funcName,req.body.funcArgs);
    //TODO 
    if(!answer) return res.status(404).send('There is no chaincode found !');
    console.log(answer);
    res.send(answer);
});

//To invoke the chaincode
app.post('/api/chaincode/invoke',async (req,res)=>{
    //check whether the request content is valid
    const schema = {
        networkName : Joi.string().min(3).required(),
        chaincodeName : Joi.string().min(3).required(),
        funcName : Joi.string().min(3).required(),
        funcArgs : Joi.required()
    };
    const result = Joi.validate(req.body,schema);
    if(result.error){
        console.log(result.error);
        return res.status(400).send(result.error);
    }

    let answer 
        = await Gateway.submitTxnContract(req.body.networkName,req.body.chaincodeName,req.body.funcName,req.body.funcArgs);
    //TODO 
    if(!answer) return res.status(404).send('There is no chaincode found !');
    console.log(answer);
    res.send({Response : answer});
});




const port = process.env.PORT || 3000
app.listen(port,()=> console.log(`server start on ${port}...`));


