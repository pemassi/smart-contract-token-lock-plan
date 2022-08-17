async function expectThrow(promise, message) 
{
  try 
  {
    await promise;
  } 
  catch (error) 
  {
    assert(
      error.message.search(message),
      "Expected message not found. (expected: " + message + " / actual: " + error.message + ")"
    )
    return;
  }
  assert.fail('Expected throw not received');
};

module.exports = {
  expectThrow,
};