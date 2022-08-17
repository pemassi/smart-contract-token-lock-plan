// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";

contract TokenLockPlan {

    struct LockPlan {
        uint256 amount;
        uint256 unlockTimestamp;
    }

    // Flags
    bool public isLocked;
    bool internal reentrancyFlag;   // boolean to prevent reentrancy

    // Library usage
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Contract owner
    address payable public owner;

    // Timestamp related variables
    uint256 public initialTimestamp;    // The time locking started
    bool public timestampSet;

    // Token amount variables
    mapping(address => LockPlan[]) public lockPlans;
    mapping(address => uint256) public alreadyWithdrawn;
    mapping(address => uint256) public balances;
    uint256 public contractBalance;

    // ERC20 contract address
    IERC20 public erc20Contract;

    // Events
    event TokensDeposited(address from, uint256 amount);
    event AllocationPerformed(address recipient, uint256 amount);
    event TokensUnlocked(address recipient, uint256 amount);

    /// @dev Deploys contract and links the ERC20 token which we are timelocking, also sets owner as msg.sender and sets timestampSet bool to false.
    /// @param _erc20_contract_address.
    constructor(IERC20 _erc20_contract_address) {
        // Allow this contract's owner to make deposits by setting allIncomingDepositsFinalised to false
        isLocked = false;

        // Set contract owner
        owner = payable(msg.sender);

        // Timestamp values not set yet
        timestampSet = false;

        // Set the erc20 contract address which this timelock is deliberately paired to
        require(address(_erc20_contract_address) != address(0), "_erc20_contract_address address can not be zero");
        erc20Contract = _erc20_contract_address;

        // Initialize the reentrancy variable to not locked
        reentrancyFlag = false;
    }

    // Modifier
    /**
     * @dev Prevents reentrancy
     */
    modifier noReentrant() {
        require(!reentrancyFlag, "No re-entrancy");
        reentrancyFlag = true;
        _;
        reentrancyFlag = false;
    }

    // Modifier
    /**
     * @dev Throws if allIncomingDepositsFinalised is true.
     */
    modifier notLocked() {
        require(isLocked == false, "Incoming deposits have been finalised.");
        _;
    }

    // Modifier
    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Message sender must be the contract's owner.");
        _;
    }

    // Modifier
    /**
     * @dev Throws if timestamp already set.
     */
    modifier timestampNotSet() {
        require(timestampSet == false, "The time stamp has already been set.");
        _;
    }

    // Modifier
    /**
     * @dev Throws if timestamp not set.
     */
    modifier timestampIsSet() {
        require(timestampSet == true, "Please set the time stamp first, then try again.");
        _;
    }

    receive() payable external notLocked {
        contractBalance = contractBalance.add(msg.value);
        emit TokensDeposited(msg.sender, msg.value);
    }

    /// @dev Takes away any ability (for the contract owner) to assign any tokens to any recipients. 
    /// This function is only to be called by the contract owner. 
    /// Calling this function can not be undone. 
    /// Calling this function must only be performed when all of the addresses and amounts are allocated (to the recipients). 
    /// This function finalizes the contract owners involvement and at this point the contract's timelock functionality is non-custodial
    function finalizeAllIncomingDeposits() public onlyOwner timestampIsSet notLocked {
        // Check contract balance is equal to all locked token amount.
        revert("TODO");

        // Record locking start time
        initialTimestamp = block.timestamp;

        // Make owner cannot access anymore
        isLocked = true;
    }

    /// @dev Function to withdraw Eth in case Eth is accidently sent to this contract.
    /// @param amount of network tokens to withdraw (in wei).
    function withdrawEth(uint256 amount) public onlyOwner noReentrant{
        require(amount <= contractBalance, "Insufficient funds");
        contractBalance = contractBalance.sub(amount);

        // Transfer the specified amount of Eth to the owner of this contract
        owner.transfer(amount);
    }

    /// @dev Allows the contract owner to allocate official ERC20 tokens to each future recipient (only one at a time).
    /// @param recipient, address of recipient.
    /// @param unlockTimestamps, timestamp when token is unlocked
    /// @param amounts, amount of locking token
    function addLockPlan(address recipient, uint256[] calldata unlockTimestamps, uint256[] calldata amounts) public onlyOwner notLocked {
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(unlockTimestamps.length == amounts.length, "The unlockTimestamps and amounts must be the same size.");
        
        for(uint256 i = 0; i < unlockTimestamps.length; i++)
        {
            uint256 unlockTimestamp = unlockTimestamps[i];
            uint256 amount = amounts[i];
            lockPlans[recipient].push(
                LockPlan(
                    amount,
                    unlockTimestamp
                )
            );

            emit AllocationPerformed(recipient, amount);
        }
    }

    /// @dev Allows the contract owner to allocate official ERC20 tokens to multiple future recipient in bulk.
    /// @param recipients, an array of addresses of the many recipient.
    /// @param amounts to allocate to each of the many recipient.
    function bulkDepositTokens(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner timestampIsSet notLocked {
        require(recipients.length == amounts.length, "The recipients and amounts arrays must be the same size in length");
        
        revert("TODO");
        // for(uint256 i = 0; i < recipients.length; i++) {
        //     require(recipients[i] != address(0), "ERC20: transfer to the zero address");
        //     balances[recipients[i]] = balances[recipients[i]].add(amounts[i]);
        //     emit AllocationPerformed(recipients[i], amounts[i]);
        // }
    }

    /// @dev Allows recipient to unlock tokens after 24 month period has elapsed
    /// @param to - the recipient's account address.
    /// @param amount - the amount to unlock (in wei)
    function transferTimeLockedTokensAfterTimePeriod(address to, uint256 amount) public timestampIsSet noReentrant {
        // Validate
        require(to != address(0), "ERC20: transfer to the zero address");
        require(balances[to] >= amount, "Insufficient token balance, try lesser amount");
        require(msg.sender == to, "Only the token recipient can perform the unlock");

        revert("TODO");
        // if (block.timestamp >= timePeriod) {
        //     alreadyWithdrawn[to] = alreadyWithdrawn[to].add(amount);
        //     balances[to] = balances[to].sub(amount);
        //     erc20Contract.safeTransfer(to, amount);
        //     emit TokensUnlocked(to, amount);
        // } else {
        //     revert("Tokens are only available after correct time period has elapsed");
        // }
    }

    /// @dev Transfer accidentally locked ERC20 tokens.
    /// @param token - ERC20 token address.
    /// @param amount of ERC20 tokens to remove.
    function transferAccidentallyLockedTokens(IERC20 token, uint256 amount) public onlyOwner noReentrant {
        // Validate
        require(address(token) != address(0), "Token address can not be zero.");
        require(token != erc20Contract, "Only token which is not locked by this contract can be transfered.");
        
        token.safeTransfer(owner, amount);
    }
}