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

    //************************** TEST ERC20 - this is copy&paste from reliable sources *******************************
    it("new contract has 0 tokens", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 0, "everything should be empty");
            return contract.mint(accounts[0], 1000, {from: accounts[1]});
        }).then(function (balance) {
            assert.equal(false, "only owner can mint");
        }).catch(function (e) {
            return contract.mint(accounts[0], 1000, {from: accounts[0]});
        }).then(function (balance) {
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
