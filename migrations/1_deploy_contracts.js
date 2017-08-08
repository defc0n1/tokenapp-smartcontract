var ModumToken = artifacts.require("./ModumToken.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(ModumToken, {from: accounts[0]});
};
