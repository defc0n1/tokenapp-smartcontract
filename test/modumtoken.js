var ModumToken = artifacts.require("./ModumToken.sol");

contract('ModumToken', function (accounts) {

    //https://ethereum.stackexchange.com/questions/15567/truffle-smart-contract-testing-does-not-reset-state/15574#15574
    var contract;
    beforeEach(function () {
        return ModumToken.new()
            .then(function(instance) {
                contract = instance;
            });
    });

    //************************** TEST ERC20 - the smart contract code is copy&paste from reliable sources ************
    it("test ERC20 basic functionality", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 0, "everything should be empty");
            return contract.mint(accounts[0], 1000, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "only owner can mint");
        }).catch(function (e) {
            return contract.mint(accounts[0], 1000, {from: accounts[0]});
        }).then(function (retVal) {
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "balance is 1000, seen by any account");
            return contract.balanceOf.call(accounts[0], {from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "balance is 1000, seen by any account");
            return contract.getUnlockedTokens.call({from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "unlocked tokens are 1000");
            return contract.totalSupply.call({from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 9900000 + 1000, "unlocked tokens are 1000");
            return contract.transfer(accounts[1], 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "minting not done yet, cannot transfor");
        }).catch(function (e) {
            //minting done
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            return contract.transfer(accounts[1], 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "account 1 does not have any tokens");
        }).catch(function (e) {
            return contract.transfer(accounts[1], 0, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "cannot transfor 0 tokens");
        }).catch(function (e) {
            return contract.transfer(accounts[1], -1, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "negative values are not possible");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "cannot steal tokens from another account");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1001, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "account 0 only has 1000 tokens, cannot transfor 1001");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1000, {from: accounts[0]});
        }).then(function (retVal) {
            //transfer was successful
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "we sent from account 0 to account 0, so account 0 has still 1000 tokens");
            return contract.transfer(accounts[1], 1000, {from: accounts[0]});
        }).then(function (retVal) {
            return contract.balanceOf.call(accounts[0], {from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 0, "we transfer all tokens to account 1");
            return contract.balanceOf.call(accounts[1], {from: accounts[2]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "account 1 has 1000 tokenscd ");
        });
    });



    //************************** TEST Minting Flag *******************************
    it("minting flag tests", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.setMintDone({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "minting finished can only be called from the owner");
        }).catch(function (e) {
            return contract.isMintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is not done yet, we can call this from any account");
            return contract.isMintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is still not done yet, we can call this from any account");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            //console.log("now minting is set to done");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "cannot call minting done this twice");
        }).catch(function (e) {
            return contract.isMintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
            return contract.isMintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
        });
    });



});
