const { expectThrow } = require("../helper/expectThrow");
const TokenLockPlan = artifacts.require("TokenLockPlan");

contract("TokenLockPlan", (accounts) => {
  let instance;

  let _tokenContract = "0x6BDd97Dfb3BEbc61aDC2Be51a0776fb3003B839e";
  let owner = accounts[0];
  let user1 = accounts[1];
  let user2 = accounts[2];

  beforeEach(async () => {
    instance = await TokenLockPlan.new(_tokenContract);
  });

  describe("Test Constructor", () => {
    it("isLocked should be false", async () => {
      assert.equal(await instance.isLocked(), false);
    });
  });


  describe("Test Method: addLockPlan", () => {
    it("Throw when recipient is 0", async () => {
      await expectThrow(
        instance.addLockPlan("0", [], []),
        "ERC20: transfer to the zero address"
      )
    });

    it("Throw when unlockTimestamps and amounts sizes are not equal", async () => {
      await expectThrow(
        instance.addLockPlan(user1, [1], []),
        "The unlockTimestamps and amounts must be the same size"
      )

      await expectThrow(
        instance.addLockPlan(user1, [], [1]),
        "The unlockTimestamps and amounts must be the same size"
      )
    });

    it("Successfully added", async () => {
      // Add Lock Plan
      let amounts = [1, 2]
      let unlockTimestamps = [10, 20]
      await instance.addLockPlan(user1, unlockTimestamps, amounts)

      // Check Added
      let lockPlan1 = await instance.lockPlans.call(user1, 0)
      assert.equal(lockPlan1[0].toNumber(), 1);
      assert.equal(lockPlan1[1].toNumber(), 10);

      let lockPlan2 = await instance.lockPlans.call(user1, 1)
      assert.equal(lockPlan2[0].toNumber(), 2);
      assert.equal(lockPlan2[1].toNumber(), 20);
    });


  });
  
});