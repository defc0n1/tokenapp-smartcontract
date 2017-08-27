var ModumToken = artifacts.require("./ModumToken.sol");
var utils = require('../lib/utils');

contract('ModumToken', function (accounts) {

    //https://ethereum.stackexchange.com/questions/15567/truffle-smart-contract-testing-does-not-reset-state/15574#15574
    var contract;
    beforeEach(function () {
        return ModumToken.new()
            .then(function(instance) {
                contract = instance;
            });
    });

    it("minting single test", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.mint([accounts[0]], [1000], {from: accounts[0]});
        }).then(function (balance) {
            return utils.testTokens(contract, accounts, 9900000, 1000, 1000, 0);
        });
    });

    it("minting single wrong owner", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.mint([accounts[0]], [1000], {from: accounts[2]});
        }).then(function (retVal) {
            assert.equal(false, "wrong owner!");
        }).catch(function (e) {
            return utils.testTokens(contract, accounts, 9900000, 0, 0, 0);
        });
    });

    it("minting too much and bulk test", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.mint([accounts[0],accounts[1]], [1000, 20100000 - 1000], {from: accounts[0]});
        }).then(function (balance) {
            return contract.mint([accounts[2]], [1], {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "we have already sold all our tokens ");
        }).catch(function (e) {
            return utils.testTokens(contract, accounts, 9900000, 20100000, 1000, 20100000 - 1000);
        });
    });

    it("minting too much and bulk test rollback", function () {
        return ModumToken.deployed().then(function (instance) {
            return  contract.mint([accounts[0],accounts[1], accounts[2]], [1000, 20100000 - 1000, 1], {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "we have already sold all our tokens ");
        }).catch(function (e) {
            return utils.testTokens(contract, accounts, 9900000, 0, 0, 0);
        })
    });

    it("minting flag tests", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.setMintDone({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "minting finished can only be called from the owner");
        }).catch(function (e) {
            return contract.mintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is not done yet, we can call this from any account");
            return contract.mintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is still not done yet, we can call this from any account");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "cannot call minting done this twice");
        }).catch(function (e) {
            return contract.mintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
            return contract.mintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
        });
    });
});
