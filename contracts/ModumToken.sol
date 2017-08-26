pragma solidity ^0.4.14;

import './SafeMath.sol';


//https://theethereum.wiki/w/index.php/ERC20_Token_Standard
contract ERC20Interface {

    // Get the total token supply
    function totalSupply() constant returns (uint256 totalSupply);

    // Get the account balance of another account with address _owner
    function balanceOf(address _owner) constant returns (uint256 balance);

    // Send _value amount of tokens to address _to
    function transfer(address _to, uint256 _value) returns (bool success);

    // Send _value amount of tokens from address _from to address _to
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success);

    // Allow _spender to withdraw from your account, multiple times, up to the _value amount.
    // If this function is called again it overwrites the current allowance with _value.
    // this function is required for some DEX functionality
    function approve(address _spender, uint256 _value) returns (bool success);

    // Returns the amount which _spender is still allowed to withdraw from _owner
    function allowance(address _owner, address _spender) constant returns (uint256 remaining);
    // Triggered when tokens are transferred.
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    // Triggered whenever approve(address _spender, uint256 _value) is called.
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

contract ModumToken is ERC20Interface {

    using SafeMath for uint256;
    
    address owner;
    mapping(address => Account) accounts;
    mapping(address => mapping (address => uint256)) allowed;
    
    enum UpdateMode{None,Wei,Vote,Both}

	struct Account {
	    uint lastProposalStartTime; //For checking at which proposal valueModVote was last updated
		uint lastAirdropWei; //For checking after which airDrop bonusWei was last updated 
		uint bonusWei;      //airDrop/Dividend payout avaiable for withdrawl
		uint valueModVote;  // votes avaiable for voting on active Proposal
		uint valueMod;      // the owned tokens
    }
    
    uint totalDropPerUnlockedToken = 0;     //totally airdropped eth per unlocked token
    uint rounding = 0;                      //airdrops not accounted yet to make system rounding error proof

    uint unlockedTokens = 0;                //tokens that can vote, transfer, receive dividend
    uint lockedTokens = 9 * 1100 * 1000;   //token that need to be unlocked by voting
    uint maxTokens = 30 * 1000 * 1000;      //max distributable tokens

    bool mintDone = false;           //distinguisher for minting phase
    uint votingDuration = 2 weeks;
    
    string public constant name = "Modum Token";
    string public constant symbol = "MOD";
    
    struct Proposal {
        string addr;        //Uri for more info
        bytes32 hash;       //Hash of the uri content for checking 
        uint valueMod;      //token to unlock: proposal with 0 amount is invalid
        uint startTime;
        uint yay;   
        uint nay;
    }
    
    Proposal currentProposal; 

    function ModumToken() {
        owner = msg.sender;
    }
	
	event Minted(address _addr, uint tokens);
	event Voted(address _addr, bool option, uint votes);
	event Payout(uint weiPerToken);

    function proposal(string _addr, bytes32 _hash, uint _value) {
        require(msg.sender == owner); // proposal ony by onwer
        require(!isProposalActive()); // no proposal is active
        require(_value <= lockedTokens); //proposal cannot be larger than remaining locked tokens
        require(_value > 0); //there needs to be locked tokens to make proposal, at least 1 locked token
        require(_hash > 0); //hash need to be set
        require(bytes(_addr).length > 0); //the address need to be set and non-empty
        require(mintDone); //minting phase needs to be over

        uint _yay = 0;
        uint _nay = 0;
        currentProposal = Proposal(_addr, _hash, _value, now, _yay, _nay);
    }
    
    function vote(bool _vote) returns (uint) {
        require(isVoteOngoing()); // vote needs to be ongoing
        Account storage account = getAccount(msg.sender, UpdateMode.Vote);
        uint votes = account.valueModVote;  //avaiable votes
        require(votes > 0);  //voter must have a vote left
        
        if(_vote) {
            currentProposal.yay = currentProposal.yay.add(votes);
        } else {
            currentProposal.nay = currentProposal.nay.add(votes);
        }
        
        account.valueModVote = 0;
		Voted(msg.sender,_vote,votes);
        return votes;
    }

    function showVotes(address _addr) constant returns (uint) {
        Account memory account = accounts[_addr];
        if(account.lastProposalStartTime < currentProposal.startTime || // the user did set his token power yet
            (account.lastProposalStartTime == 0 && currentProposal.startTime == 0)) {
                return account.valueMod;
        }
        return account.valueModVote;
    }
    
    function claimProposal() {
        require(msg.sender == owner); //only owner can claim proposal
        require(isProposalActive()); // proposal active
        require(isVotingPhaseOver()); // voting has already ended

        if(currentProposal.yay > currentProposal.nay && currentProposal.valueMod > 0) {
            //It was accepted
            Account storage account = getAccount(owner, UpdateMode.Both);
            uint valueMod = currentProposal.valueMod;
            account.valueMod = account.valueMod.add(valueMod); //uadd to owner
            unlockedTokens = unlockedTokens.add(valueMod); //unlock
            lockedTokens = lockedTokens.sub(valueMod); //unlock
        }
        delete currentProposal; //proposal ended
    }

    function mint(address[] _recipient, uint[] _value)  {
        require(msg.sender == owner); //only owner can claim proposal
        require(!mintDone); //only during minting
        require(_recipient.length == _value.length); //input need to be of same size

        for(uint16 i=0;i<_recipient.length;i++) {
            //here we check that we never exceed the 30mio max tokens. This includes
            //the locked and the unlocked tokens. For that no safeMath is used,
            //as these values are set by us and the max lockedtokens are 9.9mio, while
            //the max unlockedtokens are 20.1mio
            require(lockedTokens.add(unlockedTokens).add(_value[i]) <= maxTokens); //do not exceed max

            Account storage account = getAccount(_recipient[i], UpdateMode.Both);
            account.valueMod = account.valueMod.add(_value[i]); //create the tokens and add to recipient
            unlockedTokens = unlockedTokens.add(_value[i]); //create tokens
		    Minted(_recipient[i], _value[i]);
        }
    }
    
    function setMintDone() {
        require(msg.sender == owner); //only owner
        require(!mintDone); //only in minting

        mintDone = true; //end the minting
    }

    function isMintDone() constant returns (bool) {
        return mintDone;
    }
    
    //default function to pay bonus, anybody that sends eth to this contract will distribute the wei
    //to their token holders
    //Dividend payment / Airdrop
    function() payable {
        require(mintDone); //minting needs to be over

        uint value = msg.value.add(rounding); //add old runding
        rounding = value % unlockedTokens; //ensure no rounding error
		uint weiPerToken = value.sub(rounding).div(unlockedTokens);
        totalDropPerUnlockedToken = totalDropPerUnlockedToken.add(weiPerToken); //account for locked tokens and add the drop
		Payout(weiPerToken);
	}

    function showBonus() constant returns (uint) {
        uint bonus = totalDropPerUnlockedToken.sub(accounts[msg.sender].lastAirdropWei);
        if(bonus != 0) {
            return accounts[msg.sender].bonusWei.add(bonus.mul(accounts[msg.sender].valueMod));
        }
        return accounts[msg.sender].bonusWei;
    }

    function claimBonus() returns (uint){
        require(mintDone); //minting needs to be over

        Account storage account = getAccount(msg.sender, UpdateMode.Wei);
        uint sendValue = account.bonusWei; //fetch the values
        if(sendValue != 0){
            account.bonusWei = 0;           //set to zero (before against reentry) 
            msg.sender.transfer(sendValue); //send the bonus to the correct account
            return sendValue;
        }
        return 0;
    }

    function getLockedTokens() constant returns (uint) {
        return lockedTokens;
    }

    //locked tokens do not count for the total supply: locked tokens cannot vote, tranfer, or claim bonus
    function totalSupply() constant returns (uint) {
        return unlockedTokens;
    }
    
    function balanceOf(address _owner) constant returns (uint balance) {
        return accounts[_owner].valueMod;
    }
    
    function isVoteOngoing() constant returns (bool)  {
        return isProposalActive()
            && now >= currentProposal.startTime
            && now < currentProposal.startTime.add(votingDuration);
            //its safe to use it for longer periods:
            //https://ethereum.stackexchange.com/questions/6795/is-block-timestamp-safe-for-longer-time-periods
    }

    function isProposalActive() constant returns (bool)  {
        return currentProposal.hash > 0;
    }

    function isVotingPhaseOver() constant returns (bool)  {
        //its safe to use it for longer periods:
        //https://ethereum.stackexchange.com/questions/6795/is-block-timestamp-safe-for-longer-time-periods
        return now >= currentProposal.startTime.add(votingDuration);
    }
    
	function getAccount(address _addr, UpdateMode mode) internal returns(Account storage){        
        Account storage account = accounts[_addr];
		if(mode == UpdateMode.Vote || mode == UpdateMode.Both){
		    if(isVoteOngoing() && account.lastProposalStartTime < currentProposal.startTime) { // the user did set his token power yet
                account.valueModVote = account.valueMod;
                account.lastProposalStartTime = currentProposal.startTime;
            }
		}
		
		if(mode == UpdateMode.Wei || mode == UpdateMode.Both){
            uint bonus = totalDropPerUnlockedToken.sub(account.lastAirdropWei);
            if(bonus != 0){
    			account.bonusWei = account.bonusWei.add(bonus.mul(account.valueMod));
    			account.lastAirdropWei = totalDropPerUnlockedToken;
    		}
		}
		
		return account;
    }
    
    function transfer(address _to, uint _value) returns (bool success) {
        require(mintDone);
        require(_value > 0);
        Account storage tmpFrom = getAccount(msg.sender, UpdateMode.None);
        require(tmpFrom.valueMod >= _value);

        Account storage from = getAccount(msg.sender, UpdateMode.Both);
        Account storage to = getAccount(_to, UpdateMode.Both);
        from.valueMod = from.valueMod.sub(_value);
        to.valueMod = to.valueMod.add(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
        require(mintDone);
        require(_value > 0);
        Account storage tmpFrom = getAccount(_from, UpdateMode.None);
        require(tmpFrom.valueMod >= _value);
        require(allowed[_from][msg.sender] >= _value);

        Account storage from = getAccount(_from, UpdateMode.Both);
        Account storage to = getAccount(_to, UpdateMode.Both);
        from.valueMod = from.valueMod.sub(_value);
        to.valueMod = to.valueMod.add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

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

    function allowance(address _owner, address _spender) constant returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    function increaseApproval (address _spender, uint _addedValue) returns (bool success) {
        allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }

    function decreaseApproval (address _spender, uint _subtractedValue) returns (bool success) {
        uint oldValue = allowed[msg.sender][_spender];
        if (_subtractedValue > oldValue) {
            allowed[msg.sender][_spender] = 0;
        } else {
            allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
        return true;
    }
}