pragma solidity ^0.4.2;


import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/ModumToken.sol";


contract TestModumToken {

/*

testrpc
geth attach http://localhost:8545

var filter = web3.eth.filter({fromBlock: 0, toBlock: "latest"});
filter.watch(function (error, result) {
  console.log("RESULT: " + result.data);
});

filter.stopWatching();
event logA(string s, address a);
*/
    ModumToken meta;
    function beforeEach() {
        meta = new ModumToken();
    }

    function testInitialValues() {
        Assert.equal(meta.balanceOf(msg.sender), 0, "Owner should have 0 ModumToken initially");
        Assert.equal(meta.getLockedTokens(), 9900000, "9'900'000 are the locked tokens");
        Assert.equal(meta.totalSupply(), 0, "no unlocked tokens from the beginning");
        Assert.equal(meta.isMintDone(), false, "minting is active for newly created contracts");
    }
}
