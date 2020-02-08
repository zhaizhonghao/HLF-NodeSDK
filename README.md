> # Hyperledger Fabric RESTful API based on node Express
> TOM ZHAI
<img src="https://github.com/zhaizhonghao/HLF-NodeSDK/blob/master/img/hyperledger-icon.jpg" height="30%">

# Description
This project shows the RESTful API built on the fabric nodeSDK using node Express.
***
# Build
1. Prerequisite 
Copy the sub-folder of the **chaincode**  into your `$GOPATH/src`
2. To install the dependencies
```js
npm install
```
3. Run 

```js
node app.js
```



***
# DOC for API

* Initiate the credStore

* Query information of the specific peer
* Query the height of the lastest block
* Query the block information by the block height
* Query the hash of the genesis block
* Check the instantiated chaincodes in the specific channel
* Query the information about the transaction by TxID
* Import the identity into the wallet
* List the identities existing in the wallet
* Export the chosen identity from the wallet
* Install the chaincode in the specific channel
* Instantiate the chaincode in the specific channel
* Query the specific channel
* Invoke the specific channel

# TODO

* Create the channel
* Join the channel
* Generate the Identity
* Add a new organization
* Add a new peer
* Add a new user
* Add a new client