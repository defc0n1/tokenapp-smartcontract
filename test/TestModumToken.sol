pragma solidity ^0.4.2;


import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/ModumToken.sol";


contract TestModumToken {
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
