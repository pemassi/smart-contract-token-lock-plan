// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract TokenLockPlan is ReentrancyGuard, Ownable {

    struct LockPlan {
        uint256 amount;
        uint256 unlockAfterSecs;
    }

    // Flags
    bool public isLocked;

    // Library usage
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Lock Plan
    mapping(address => LockPlan[]) public lockPlans;
    EnumerableSet.AddressSet private lockPlanRecipients;

    // Token Balance
    mapping(address => uint256) public balances;
    mapping(address => uint256) public alreadyWithdrawn;
    uint256 public totalBalance;
    uint256 public contractEthBalance;

    // Lock Timestamp
    uint256 public lockStartTimestamp;

    // Lock ERC20 Contract
    IERC20 public erc20Contract;

    // Events
    event EthDeposited(address from, uint256 amount);
    event TokensLocked(address recipient, uint256 amount);
    event TokensWithdrawed(address recipient, uint256 amount);

    /// @dev Deploys contract and links the ERC20 token which we are locking.
    /// @param _erc20_contract_address, the ERC20 token address that we are locking
    constructor(IERC20 _erc20_contract_address) {
        isLocked = false;
        erc20Contract = _erc20_contract_address;
    }

    /// @dev the plan should be locked
    modifier locked() {
        require(isLocked == true, "TokenLockPlan: Plan is unlocked");
        _;
    }

    /// @dev the plan should be unlocked
    modifier notLocked() {
        require(isLocked == false, "TokenLockPlan: Plan is locked");
        _;
    }

    receive() payable external notLocked {
        /// Tracking accidently deposited ETH for later
        contractEthBalance = contractEthBalance.add(msg.value);
        emit EthDeposited(msg.sender, msg.value);
    }

    /// @dev Lockup the Plan
    /// This will lockup the plan, and the owner will not able to transfer the target token anymore.
    /// The owner can only transfer the target token that excceed total balance of lock plan.
    function lockup() public onlyOwner notLocked {
        // Check contract balance is equal to all locked token amount.
        require(erc20Contract.balanceOf(address(this)) >= totalBalance, "TokenLockPlan: Depoisted contract balance is less than total locking amount");

        // Record Lock Start Time
        lockStartTimestamp = block.timestamp;

        // Make owner cannot access anymore
        isLocked = true;
    }

    /// @dev Set the Lock Plan for recipient.
    /// The original lock plan of recipient will be replaced by this new plan.
    /// @param recipient, the address of recipient
    /// @param unlockAfterSecs, the seconds to unlock after the lock (in secs)
    /// @param lockAmounts, amount of locking token
    function setLockPlan(address recipient, uint256[] calldata unlockAfterSecs, uint256[] calldata lockAmounts) public onlyOwner notLocked {
        require(recipient != address(0), "TokenLockPlan: recipient is the zero address");
        require(unlockAfterSecs.length == lockAmounts.length, "TokenLockPlan: unlockAfterSecs and lockAmounts must be the same length");
        
        // Delete the original lock plan
        delete lockPlans[recipient];

        // Add recipient to lock plan recipients
        lockPlanRecipients.add(recipient);

        for(uint256 i = 0; i < unlockAfterSecs.length; i++)
        {
            // Add lock plan
            lockPlans[recipient].push(
                LockPlan(
                    lockAmounts[i],
                    unlockAfterSecs[i]
                )
            );

            // Track lock balance
            balances[recipient] = balances[recipient].add(lockAmounts[i]);
            totalBalance = totalBalance.add(lockAmounts[i]);

            emit TokensLocked(recipient, lockAmounts[i]);
        }
    }

    /// @dev Set the Lock Plans for many recipient.
    /// The original lock plan of recipient will be replaced by this new plan.
    /// @param recipients, the address of recipient
    /// @param unlockAfterSecss, the seconds to unlock after the lock (in secs)
    /// @param lockAmountss, amount of locking token
    function bulkSetLockPlan(address[] calldata recipients, uint256[][] calldata unlockAfterSecss, uint256[][] calldata lockAmountss) external onlyOwner notLocked {
        require(recipients.length == unlockAfterSecss.length && unlockAfterSecss.length == lockAmountss.length, "TokenLockPlan: recipients, unlockAfterSecss and lockAmountss must be the same length");
        
        for(uint256 i = 0; i < recipients.length; i++)
        {
            setLockPlan(recipients[i], unlockAfterSecss[i], lockAmountss[i]);
        }
    }

    /// @dev Get lockPlan length of recipient
    function lockPlanLength(address recipient) public view returns (uint256) {
        require(recipient != address(0), "TokenLockPlan: recipient is the zero address");

        return lockPlans[recipient].length;
    }

    /// @dev Check how many tokens has been unlocked for me.
    function myUnlockedTokenBalance() public view returns (uint256) {
        return unlockedTokenBalance(msg.sender);
    }

    /// @dev Check how many tokens has been unlocked for recipient.
    /// @param recipient, the address of recipient
    function userUnlockedTokenBalance(address recipient) public onlyOwner view returns (uint256) {
        return unlockedTokenBalance(recipient);
    }

    /// @dev Check how many tokens has been unlocked for recipient.
    /// @param recipient, the address of recipient
    function unlockedTokenBalance(address recipient) private locked view returns (uint256) {
        require(recipient != address(0), "TokenLockPlan: recipient is the zero address");

        // Calculate unlocked token balance
        uint256 unlockedBalance = 0;
        for(uint256 i = 0; i < lockPlans[recipient].length; i++)
        {
            if(block.timestamp >= lockStartTimestamp + lockPlans[recipient][i].unlockAfterSecs)
            {
                unlockedBalance = unlockedBalance.add(lockPlans[recipient][i].amount);
            }
        }

        return unlockedBalance;
    }

    /// @dev Withdraw my unlocked token
    /// @param withdrawAmount, the amount of withdrawing token (in wei)
    function withdrawMyUnlockedToken(uint256 withdrawAmount) public locked {
        withdrawUnlockedToken(msg.sender, withdrawAmount);
    }

    /// @dev Withdraw user unlocked token
    /// @param recipient, the address of recipient
    /// @param withdrawAmount, the amount of withdrawing token (in wei)
    function withdrawUserUnlockedToken(address recipient, uint256 withdrawAmount) public onlyOwner locked {
        withdrawUnlockedToken(recipient, withdrawAmount);
    }

    /// @dev Withdraw all user unlocked token
    function withdrawAllUserUnlockedToken() public onlyOwner locked {
        for(uint256 i = 0; i < lockPlanRecipients.length(); i++)
        {
            //Check unlockedTokenAmount
            address recipient = lockPlanRecipients.at(i);
            uint256 unlockedBalance = unlockedTokenBalance(recipient);
            uint256 witrhdrawAmount = unlockedBalance - alreadyWithdrawn[recipient];

            if(witrhdrawAmount > 0)
            {
                withdrawUnlockedToken(recipient, witrhdrawAmount);
            }
        }
    }

    /// @dev Withdraw unlocked token of sender
    /// @param recipient, the address of recipient
    /// @param withdrawAmount, the amount of withdrawing token (in wei)
    function withdrawUnlockedToken(address recipient, uint256 withdrawAmount) private nonReentrant locked {
        // Validate
        require(recipient != address(0), "TokenLockPlan: recipient is the zero address");
        require(erc20Contract.balanceOf(address(this)) >= withdrawAmount, "TokenLockPlan: Insufficient contract balance");
        require(balances[recipient] >= withdrawAmount, "TokenLockPlan: Insufficient recipient balance");

        // Calculate unlocked token balance
        uint256 unlockedBalance = unlockedTokenBalance(recipient);
        
        // Calaculate withdrawable token balance
        require(unlockedBalance.sub(alreadyWithdrawn[recipient]) >= withdrawAmount, "TokenLockPlan: Amount excceed unlocked balance");

        // Transfer
        alreadyWithdrawn[recipient] = alreadyWithdrawn[recipient].add(withdrawAmount);
        balances[recipient] = balances[recipient].sub(withdrawAmount);
        totalBalance = totalBalance.sub(withdrawAmount);
        erc20Contract.safeTransfer(recipient, withdrawAmount);
        emit TokensWithdrawed(recipient, withdrawAmount);
    }

    /// @dev Get balance of deposited ETH into this contract.
    function depositedEthBalance() public view returns (uint256) {
        return contractEthBalance;
    }

    /// @dev Transfer deposited tokens before lockup to onwer.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferDepositedTokensToOnwer(uint256 amount) public onlyOwner nonReentrant notLocked {
        erc20Contract.safeTransfer(payable(owner()), amount);
    }

    /// @dev Transfer accidentally deposited tokens before lockup to onwer.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedTokensToOnwer(uint256 amount) public onlyOwner nonReentrant locked {
        require(erc20Contract.balanceOf(address(this)) > totalBalance, "TokenLockPlan: Insufficient balance");
        require(erc20Contract.balanceOf(address(this)).sub(totalBalance) > amount, "TokenLockPlan: Amount excceed balance");

        erc20Contract.safeTransfer(payable(owner()), amount);
    }

    /// @dev Transfer accidentally deposited other ERC20 tokens to onwer.
    /// @param token, other ERC20 token contract address.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedOtherTokensToOnwer(IERC20 token, uint256 amount) public onlyOwner nonReentrant {
        // Validate
        require(token != erc20Contract, "TokenLockPlan: Token address cannot be locked token");
        
        token.safeTransfer(payable(owner()), amount);
    }

    /// @dev Transfer accidently deposited ETH to onwer.
    /// @param amount, of network tokens to withdraw (in wei).
    function transferAccidentallyDepositedEthToOnwer(uint256 amount) public onlyOwner nonReentrant{
        require(amount <= contractEthBalance, "TokenLockPlan: Insufficient balance");
        contractEthBalance = contractEthBalance.sub(amount);

        // Transfer the specified amount of Eth to the owner of this contract
        payable(owner()).transfer(amount);
    }
}