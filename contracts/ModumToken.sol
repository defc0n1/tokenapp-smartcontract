pragma solidity ^0.4.14;

import './SafeMath.sol';

//Interface declaration from: https://github.com/ethereum/eips/issues/20
contract ERC20Interface {
    // This triggers a warning: This declaration shadows an existing declaration.
    // Since we are not using totalSupply anywhere else than as this function, it can be safely ignored.
    function totalSupply() constant returns (uint256 totalSupply);
    function balanceOf(address _owner) constant returns (uint256 balance);
    function transfer(address _to, uint256 _value) returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success);
    function approve(address _spender, uint256 _value) returns (bool success);
    function allowance(address _owner, address _spender) constant returns (uint256 remaining);

    event Transfer(address indexed _from, address indexed _to, uint256 _value); // Triggered when tokens are transferred.
    event Approval(address indexed _owner, address indexed _spender, uint256 _value); // Triggered whenever approve() is called.
}

contract ModumToken is ERC20Interface {

    using SafeMath for uint256;

    address public owner;

    mapping(address => mapping (address => uint256)) public allowed;

    enum UpdateMode{Wei, Vote, Both} //update mode for the account
    struct Account {
        uint256 lastProposalStartTime; //For checking at which proposal valueModVote was last updated
        uint256 lastAirdropWei; //For checking after which airDrop bonusWei was last updated
        uint256 bonusWei;      //airDrop/Dividend payout available for withdrawal.
        uint256 valueModVote;  // votes available for voting on active Proposal
        uint256 valueMod;      // the owned tokens
    }
    mapping(address => Account) public accounts;

    //Airdorp
    uint256 public totalDropPerUnlockedToken = 0;     //totally airdropped eth per unlocked token
    uint256 public rounding = 0;                      //airdrops not accounted yet to make system rounding error proof

    //Token locked/unlocked/max
    uint256 public unlockedTokens = 0;                //tokens that can vote, transfer, receive dividend
    uint256 public lockedTokens = 9 * 1100 * 1000;   //token that need to be unlocked by voting
    uint256 public constant maxTokens = 30 * 1000 * 1000;      //max distributable tokens

    //minting phase running if false, true otherwise. Many operations can only be called when
    //minting phase is over
    bool public mintDone = false;

    //as suggested in https://theethereum.wiki/w/index.php/ERC20_Token_Standard
    string public constant name = "Modum Token";
    string public constant symbol = "MOD";
    uint8 public constant decimals = 0;

    //Voting
    struct Proposal {
        string addr;        //Uri for more info
        bytes32 hash;       //Hash of the uri content for checking
        uint256 valueMod;      //token to unlock: proposal with 0 amount is invalid
        uint256 startTime;
        uint256 yay;
        uint256 nay;
    }
    Proposal public currentProposal;
    uint256 public constant votingDuration = 2 weeks;

    event Voted(address _addr, bool option, uint256 votes); //called when a vote is casted
    event Payout(uint256 weiPerToken); //called when an someone payed ETHs to this contract, that can be distributed
    event Minted(address _addr, uint256 tokens); //called when a specific address has been minted

    function ModumToken() {
        owner = msg.sender;
    }

    /**
     * In case an owner account gets compromised, it should be possible to move control
     * over to another account. This helps in cases like the Parity multisig exploit: As
     * soon as an exploit becomes known, the affected parties might have a small time
     * window before being attacked.
     */
    function transferOwnership(address _newOwner) {
        require(msg.sender == owner);
        require(_newOwner != address(0));
        owner = _newOwner;
    }

    //*************************** Voting *****************************************
    /*
     * In addition to the the vode with address/URL and its hash, we also set the value
     * of tokens to be transfered from the locked tokens to the modum account.
     */
    function votingProposal(string _addr, bytes32 _hash, uint256 _value) {
        require(msg.sender == owner); // proposal ony by onwer
        require(!isProposalActive()); // no proposal is active, cannot vote in parallel
        require(_value <= lockedTokens); //proposal cannot be larger than remaining locked tokens
        require(_value > 0); //there needs to be locked tokens to make proposal, at least 1 locked token
        require(_hash != bytes32(0)); //hash need to be set
        require(bytes(_addr).length > 0); //the address need to be set and non-empty
        require(mintDone); //minting phase needs to be over

        currentProposal = Proposal(_addr, _hash, _value, now, 0, 0);
    }

    function vote(bool _vote) returns (uint256) {
        require(isVoteOngoing()); // vote needs to be ongoing
        Account storage account = updateAccount(msg.sender, UpdateMode.Vote);
        uint256 votes = account.valueModVote; //available votes
        require(votes > 0); //voter must have a vote left, either by not voting yet, or have modum tokens

        if(_vote) {
            currentProposal.yay = currentProposal.yay.add(votes);
        }
        else {
            currentProposal.nay = currentProposal.nay.add(votes);
        }

        account.valueModVote = 0;
        Voted(msg.sender, _vote, votes);
        return votes;
    }

    function showVotes(address _addr) constant returns (uint256) {
        Account memory account = accounts[_addr];
        if(account.lastProposalStartTime < currentProposal.startTime || // the user did set his token power yet
            (account.lastProposalStartTime == 0 && currentProposal.startTime == 0)) {
            return account.valueMod;
        }
        return account.valueModVote;
    }

    // The voting can be claimed by the owner of this contract
    function claimVotingProposal() {
        require(msg.sender == owner); //only owner can claim proposal
        require(isProposalActive()); // proposal active
        require(isVotingPhaseOver()); // voting has already ended

        if(currentProposal.yay > currentProposal.nay && currentProposal.valueMod > 0) {
            //Vote was accepted
            Account storage account = updateAccount(owner, UpdateMode.Both);
            uint256 valueMod = currentProposal.valueMod;
            account.valueMod = account.valueMod.add(valueMod); //add tokens to owner
            unlockedTokens = unlockedTokens.add(valueMod);
            lockedTokens = lockedTokens.sub(valueMod);
        }
        delete currentProposal; //proposal ended
    }

    function isProposalActive() constant returns (bool)  {
        return currentProposal.hash != bytes32(0);
    }

    function isVoteOngoing() constant returns (bool)  {
        return isProposalActive()
            && now >= currentProposal.startTime
            && now < currentProposal.startTime.add(votingDuration);
        //its safe to use it for longer periods:
        //https://ethereum.stackexchange.com/questions/6795/is-block-timestamp-safe-for-longer-time-periods
    }

    function isVotingPhaseOver() constant returns (bool)  {
        //its safe to use it for longer periods:
        //https://ethereum.stackexchange.com/questions/6795/is-block-timestamp-safe-for-longer-time-periods
        return now >= currentProposal.startTime.add(votingDuration);
    }

    //*********************** Minting *****************************************
    function mint(address[] _recipient, uint256[] _value)  {
        require(msg.sender == owner); //only owner can claim proposal
        require(!mintDone); //only during minting
        require(_recipient.length == _value.length); //input need to be of same size

        //we want to mint a couple of accounts
        for (uint16 i=0; i<_recipient.length; i++) {
            //here we check that we never exceed the 30mio max tokens. This includes
            //the locked and the unlocked tokens.
            require(lockedTokens.add(unlockedTokens).add(_value[i]) <= maxTokens);

            Account storage account = updateAccount(_recipient[i], UpdateMode.Both);
            account.valueMod = account.valueMod.add(_value[i]);
            unlockedTokens = unlockedTokens.add(_value[i]); //create the tokens and add to recipient
            Minted(_recipient[i], _value[i]);
        }
    }

    function setMintDone() {
        require(msg.sender == owner);
        require(!mintDone); //only in minting phase
        mintDone = true; //end the minting
    }

    //updates an account for voting or airdrop or both. This is required to be able to fix the amount of tokens before
    //a vote or airdrop happend.
    function updateAccount(address _addr, UpdateMode mode) internal returns (Account storage){
        Account storage account = accounts[_addr];
        if(mode == UpdateMode.Vote || mode == UpdateMode.Both) {
            if(isVoteOngoing() && account.lastProposalStartTime < currentProposal.startTime) {// the user did set his token power yet
                account.valueModVote = account.valueMod;
                account.lastProposalStartTime = currentProposal.startTime;
            }
        }

        if(mode == UpdateMode.Wei || mode == UpdateMode.Both) {
            uint256 bonus = totalDropPerUnlockedToken.sub(account.lastAirdropWei);
            if(bonus != 0) {
                account.bonusWei = account.bonusWei.add(bonus.mul(account.valueMod));
                account.lastAirdropWei = totalDropPerUnlockedToken;
            }
        }

        return account;
    }

    //*********************** Airdrop ************************************************
    //default function to pay bonus, anybody that sends eth to this contract will distribute the wei
    //to their token holders
    //Dividend payment / Airdrop
    function() payable {
        require(mintDone); //minting needs to be over

        uint256 value = msg.value.add(rounding); //add old rounding
        rounding = value % unlockedTokens; //ensure no rounding error
        uint256 weiPerToken = value.sub(rounding).div(unlockedTokens);
        totalDropPerUnlockedToken = totalDropPerUnlockedToken.add(weiPerToken); //account for locked tokens and add the drop
        Payout(weiPerToken);
    }

    function showBonus(address _addr) constant returns (uint256) {
        uint256 bonus = totalDropPerUnlockedToken.sub(accounts[_addr].lastAirdropWei);
        if(bonus != 0) {
            return accounts[_addr].bonusWei.add(bonus.mul(accounts[_addr].valueMod));
        }
        return accounts[_addr].bonusWei;
    }

    function claimBonus() returns (uint256) {
        require(mintDone); //minting needs to be over

        Account storage account = updateAccount(msg.sender, UpdateMode.Wei);
        uint256 sendValue = account.bonusWei; //fetch the values

        if(sendValue != 0) {
            account.bonusWei = 0; //set to zero (before against reentry)
            msg.sender.transfer(sendValue); //send the bonus to the correct account
            return sendValue;
        }
        return 0;
    }

    //****************************** ERC20 ************************************

    // Get the total token supply
    //locked tokens do not count for the total supply: locked tokens cannot vote, tranfer, or claim bonus
    function totalSupply() constant returns (uint256) {
        return unlockedTokens;
    }

    // Get the account balance of another account with address _owner
    function balanceOf(address _owner) constant returns (uint256 balance) {
        return accounts[_owner].valueMod;
    }

    // Send _value amount of tokens to address _to
    function transfer(address _to, uint256 _value) returns (bool success) {
        require(mintDone);
        require(_value > 0);
        Account memory tmpFrom = accounts[msg.sender];
        require(tmpFrom.valueMod >= _value);

        Account storage from = updateAccount(msg.sender, UpdateMode.Both);
        Account storage to = updateAccount(_to, UpdateMode.Both);
        from.valueMod = from.valueMod.sub(_value);
        to.valueMod = to.valueMod.add(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

    // Send _value amount of tokens from address _from to address _to
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success) {
        require(mintDone);
        require(_value > 0);
        Account memory tmpFrom = accounts[_from];
        require(tmpFrom.valueMod >= _value);
        require(allowed[_from][msg.sender] >= _value);

        Account storage from = updateAccount(_from, UpdateMode.Both);
        Account storage to = updateAccount(_to, UpdateMode.Both);
        from.valueMod = from.valueMod.sub(_value);
        to.valueMod = to.valueMod.add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

    // ********************** approve, allowance, increaseApproval, and decreaseApproval used from:
    // https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/token/StandardToken.sol
    //
    // changed from uint to uint256 as this is considered to be best practice.

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) returns (bool) {
        // To change the approve amount you first have to reduce the addresses`
        //  allowance to zero by calling `approve(_spender, 0)` if it is not
        //  already 0 to mitigate the race condition described here:
        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        require((_value == 0) || (allowed[msg.sender][_spender] == 0));

        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Function to check the amount of tokens that an owner allowed to a spender.
     * @param _owner address The address which owns the funds.
     * @param _spender address The address which will spend the funds.
     * @return A uint256 specifying the amount of tokens still available for the spender.
     */
    function allowance(address _owner, address _spender) constant returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    /*
     * approve should be called when allowed[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     */
    function increaseApproval(address _spender, uint256 _addedValue) returns (bool success) {
        allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }

    function decreaseApproval(address _spender, uint256 _subtractedValue) returns (bool success) {
        uint256 oldValue = allowed[msg.sender][_spender];
        if(_subtractedValue > oldValue) {
            allowed[msg.sender][_spender] = 0;
        } else {
            allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }
}