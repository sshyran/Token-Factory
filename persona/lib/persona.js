// Required Modules
var ipfs       = require('ipfs-js');
var PromiseLib = require('bluebird');
var Pudding = require('ether-pudding');
var Web3 = require('web3');
var web3 = new Web3();
Pudding.setWeb3(web3);

var PersonaFactory = (PersonaClass, PersonaRegistry) => {

  // NOTES
    // At run time, there's a class created for us already called
    // PersonaClass, provided by Truffle. That class represents the
    // PersonaClass contract. The following adds functions to it to make
    // it the main point of contact for interacting with personas.

  var registryInstance = PersonaRegistry.at(PersonaRegistry.deployed_address);

  PersonaClass.setRegistry = (registryAddress) => {
    registryInstance = PersonaRegistry.at(registryAddress);
  };

  PersonaClass.setIpfsProvider = (ipfsProv) => {
    ipfs.setProvider(ipfsProv);
  };

  PersonaClass.setWeb3Provider = (web3Prov) => {
    web3.setProvider(web3Prov);
  };

  PersonaClass.of = PromiseLib.promisify( (ownerAddress, callback) => {
    registryInstance
      .idLookup
      .call(ownerAddress)
      .then( (personaAddress) => { 
        callback(null, PersonaClass.at(personaAddress)); })
      .catch(callback);
  });

  PersonaClass.newPersona = PromiseLib.promisify( (info, txData, callback) => {
    if (typeof txData === 'function') {
      callback = txData;
      txData   = {};
    }

    // NOTES
      // info should be a JSON structure with attributes about the persona,
      // with top-level keys being classes of attributes. The main class now
      // will be 'personSchema' which denotes data corresponding to the
      // Schema.org Person spec.
      // {
      //  'personSchema' :
      //   {
      //    'name': 'Tim Coulter',
      //    'image': {'@type': 'ImageObject', 
      //              'name': 'avatar', 
      //              'contentUrl' : 'ipfs/QmX...'}
      //   }
      // }
      // This info hash will be the same one users get back by calling
      // persona.getInfo().

    ipfs.addJson(info, (err, ipfsHash) => {
      
      // console.log(err, ipfsHash);
      if (err !== null) { throw new Error(err); return; }

      var persona = null; // QUESTION: Does this actually get passed to the next step?
      
      PersonaClass.new(ipfsHash, txData).then( (instance) => {
      
        // console.log(instance);
        persona = instance;
      
        return registryInstance.registerPersona(persona.address, txData);

      }).then(function(tx) { callback(null, persona); // QUESTION: passing tx for no reason?
      }).catch(callback);
    });
  });

  PersonaClass.extend({
    
    getInfo(attributeClass) {
    
      return new PromiseLib( (accept, reject) => {
    
        this.ipfsHash.call().then( (ipfsHash)  => {
    
          ipfs.catJson(ipfsHash, (err, personaObj) => {
    
            if (err !== null) { reject(err); return; }
            
            var returnVal;

            attributeClass === undefined ?
              returnVal = personaObj :
              returnVal = personaObj[attributeClass];

            accept(returnVal);
          })
        }).catch(reject);
      });
    }
  });

  PersonaClass.extend({
    
    updateInfo(newInfo, txData) {
    
      return new PromiseLib( (accept, reject) => {
    
        ipfs.addJson(newInfo, (err, newIpfsHash) => {
    
          if (err !== null) { reject(err); return; }

          this.setIpfsHash(newIpfsHash, txData).then( ()  => {
    
            accept();
          }).catch(reject);
        })
      })
    }
  });

  return PersonaClass;
}

var Persona = require("../config/development/Persona.sol.js").load(Pudding);
var PersonaRegistry = require("../config/development/PersonaRegistry.sol.js").load(Pudding);
module.exports = PersonaFactory(Persona, PersonaRegistry);
