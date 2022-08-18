const { expectThrow } = require("../helper/expectThrow");
const { time } = require("@openzeppelin/test-helpers");
const TokenLockPlan = artifacts.require("TokenLockPlan");
const TestToken = artifacts.require("TestToken");

contract("TokenLockPlan", (accounts) => {
  // Instance
  let instance;
  let tokenInstance;

  // Accounts
  let owner = accounts[0];
  let user1 = accounts[1];
  let user2 = accounts[2];

  // Const
  const TOKEN_MAX_BALANCE = 1_000_000_000;

  beforeEach(async () => {
    tokenInstance = await TestToken.new(1_000_000_000);
    instance = await TokenLockPlan.new(tokenInstance.address);
  });

  describe("Test Constructor", () => {
    it("isLocked should be false", async () => {
      assert.equal(await instance.isLocked(), false);
    });
  });


  describe("Test Method: setLockPlan", () => {
    it("Throw when recipient is 0", async () => {
      await expectThrow(
        instance.setLockPlan("0", [], []),
        "ERC20: transfer to the zero address"
      )
    });

    it("Throw when unlockTimestamps and amounts sizes are not equal", async () => {
      await expectThrow(
        instance.setLockPlan(user1, [1], []),
        "The unlockTimestamps and amounts must be the same length"
      )

      await expectThrow(
        instance.setLockPlan(user1, [], [1]),
        "The unlockTimestamps and amounts must be the same length"
      )
    });

    it("Should be added", async () => {
      // Add Lock Plan
      await instance.setLockPlan(user1, [10, 20],  [1, 2])
      await instance.setLockPlan(user2, [30, 40],  [3, 4])

      // Check Added (user1)
      let lockPlanLength = await instance.lockPlanLengths.call(user1);
      assert.equal(lockPlanLength, 2);

      let lockPlan1 = await instance.lockPlans.call(user1, 0)
      assert.equal(lockPlan1[0].toNumber(), 1);
      assert.equal(lockPlan1[1].toNumber(), 10);

      let lockPlan2 = await instance.lockPlans.call(user1, 1)
      assert.equal(lockPlan2[0].toNumber(), 2);
      assert.equal(lockPlan2[1].toNumber(), 20);

      // Check Added (user2)
      let lockPlanLength2 = await instance.lockPlanLengths.call(user2);
      assert.equal(lockPlanLength2, 2);

      let lockPlan21 = await instance.lockPlans.call(user2, 0)
      assert.equal(lockPlan21[0].toNumber(), 3);
      assert.equal(lockPlan21[1].toNumber(), 30);

      let lockPlan22 = await instance.lockPlans.call(user2, 1)
      assert.equal(lockPlan22[0].toNumber(), 4);
      assert.equal(lockPlan22[1].toNumber(), 40);
    });
  });

  describe("Test Method: buldSetLockPlan", () => {
    it("Throw when recipient is 0", async () => {
      await expectThrow(
        instance.bulkSetLockPlan(["0"], [[]], [[]]),
        "ERC20: transfer to the zero address"
      )
    });

    it("Throw when recipients, unlockTimestampss and amountss sizes are not equal", async () => {
      await expectThrow(
        instance.bulkSetLockPlan([user1], [[1]], []),
        "The unlockTimestamps and amounts must be the same length"
      )

      await expectThrow(
        instance.bulkSetLockPlan([user1], [], [[1]]),
        "The unlockTimestamps and amounts must be the same length"
      )

      await expectThrow(
        instance.bulkSetLockPlan([], [[1]], [[1]]),
        "The recipients, unlockTimestampss and amountss must be the same length."
      )
    });

    it("Should be added", async () => {
      // Add Lock Plan
      await instance.bulkSetLockPlan([user1, user2], [[10, 20], [30, 40]], [[1, 2], [3, 4]])

      // Check Added (user1)
      let lockPlanLength = await instance.lockPlanLengths.call(user1);
      assert.equal(lockPlanLength, 2);

      let lockPlan1 = await instance.lockPlans.call(user1, 0)
      assert.equal(lockPlan1[0].toNumber(), 1);
      assert.equal(lockPlan1[1].toNumber(), 10);

      let lockPlan2 = await instance.lockPlans.call(user1, 1)
      assert.equal(lockPlan2[0].toNumber(), 2);
      assert.equal(lockPlan2[1].toNumber(), 20);

      // Check Added (user2)
      let lockPlanLength2 = await instance.lockPlanLengths.call(user2);
      assert.equal(lockPlanLength2, 2);

      let lockPlan21 = await instance.lockPlans.call(user2, 0)
      assert.equal(lockPlan21[0].toNumber(), 3);
      assert.equal(lockPlan21[1].toNumber(), 30);

      let lockPlan22 = await instance.lockPlans.call(user2, 1)
      assert.equal(lockPlan22[0].toNumber(), 4);
      assert.equal(lockPlan22[1].toNumber(), 40);
    });
  });

  describe("Test Method: checkUnlockedTokenBalance", () => {
    it("Should be zero", async () => {
      // Lockup
      await instance.lockup()

      let amount = await instance.checkUnlockedTokenBalance.call(user1);
      assert.equal(amount.toNumber(), 0);

      let amount2 = await instance.checkUnlockedTokenBalance.call(user2);
      assert.equal(amount2.toNumber(), 0);
    });
    
    it("Should be some unlocked", async () => {
      // Add Lock Plan
      await instance.setLockPlan(user1, [0, 100], [10, 20]);
      await instance.setLockPlan(user2, [0, 100], [30, 40]);

      // Deposit
      await tokenInstance.transfer(instance.address, 100);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 100);

      // Lockup
      await instance.lockup()

      let amount = await instance.checkUnlockedTokenBalance.call(user1);
      assert.equal(amount.toNumber(), 10);

      let amount2 = await instance.checkUnlockedTokenBalance.call(user2);
      assert.equal(amount2.toNumber(), 30);
    });
  });

  describe("Test Method: withdrawUnlockedToken", () => {

    it("Throw when tokens are still locked", async () => {
      await instance.setLockPlan(owner, [100], [10]);

      await tokenInstance.transfer(instance.address, 10);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 10);

      // Lockup
      await instance.lockup()

      await expectThrow(
        instance.withdrawUnlockedToken(owner, 10),
        "Some tokens are still locked, try lesser amount."
      )

      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 10);
    });

    it("Should be able to witrhdraw", async () => {
      await instance.setLockPlan(owner, [0, 100], [10, 20]);

      await tokenInstance.transfer(instance.address, 30);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 30);

      // Lockup
      await instance.lockup()

      await instance.withdrawUnlockedToken(owner, 10);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 20);
    });

    it("Should be able to witrhdraw in parts", async () => {
      await instance.setLockPlan(owner, [0, 100], [10, 20]);

      await tokenInstance.transfer(instance.address, 30);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 30);

      // Lockup
      await instance.lockup()

      await instance.withdrawUnlockedToken(owner, 5);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 25);

      await instance.withdrawUnlockedToken(owner, 5);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 20);
    });

    it("Should be able to witrhdraw some tokens andthrow when some tokens are still locked", async () => {
      await instance.setLockPlan(owner, [0, 100], [10, 20]);

      // Deposit
      await tokenInstance.transfer(instance.address, 30);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 30);

      // Lockup
      await instance.lockup()

      // Over amount
      await expectThrow(
        instance.withdrawUnlockedToken(owner, 20),
        "Some tokens are still locked, try lesser amount."
      )
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 30);

      // Exact Amount
      await instance.withdrawUnlockedToken(owner, 10);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 20);
    });

    it("Should be able to witrhdraw after passed timestamp", async () => {
      // Add Plan
      await instance.setLockPlan(owner, [100, 200], [10, 10]);

      // Deposit
      await tokenInstance.transfer(instance.address, 20);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 20);

      // Lockup
      await instance.lockup()

      // Before Unlock Time
      await expectThrow(
        instance.withdrawUnlockedToken(owner, 10),
        "Some tokens are still locked, try lesser amount."
      )
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 20);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await instance.withdrawUnlockedToken(owner, 10);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 10);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await instance.withdrawUnlockedToken(owner, 10);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE);
    });
  });
});