const { tx, wallet, CONST, rpc, sc, u } = require("@cityofzion/neon-core")

const defaultSystemFee = 0
const defaultNetworkFee = 0
const networkMagic = CONST.MAGIC_NUMBER.TestNet
const NS_CONTRACT_HASH = '50ac1c37690cc2cfc594472833cf57505d5f46de' // Name Service

async function checkNetworkFee(client, transaction) {
  const feePerByteInvokeResponse = await client.invokeFunction(
    CONST.NATIVE_CONTRACT_HASH.PolicyContract,
    "getFeePerByte"
  );

  if (feePerByteInvokeResponse.state !== "HALT") {
    if (defaultNetworkFee === 0) {
      throw new Error("Unable to retrieve data to calculate network fee.");
    } else {
      console.log(
        "\u001b[31m  ✗ Unable to get information to calculate network fee.  Using user provided value.\u001b[0m"
      );
      transaction.networkFee = u.BigInteger.fromNumber(defaultNetworkFee);
    }
  }

  const feePerByte = u.BigInteger.fromNumber(
    feePerByteInvokeResponse.stack[0].value
  );
  // Account for witness size
  const transactionByteSize = transaction.serialize().length / 2 + 109;
  // Hardcoded. Running a witness is always the same cost for the basic account.
  const witnessProcessingFee = u.BigInteger.fromNumber(1000390);
  const networkFeeEstimate = feePerByte
    .mul(transactionByteSize)
    .add(witnessProcessingFee);
  
  if (defaultNetworkFee && networkFeeEstimate.compare(defaultNetworkFee) <= 0) {
    transaction.networkFee = u.BigInteger.fromNumber(defaultNetworkFee);
    console.log(
      `  i Node indicates ${networkFeeEstimate.toDecimal(
        8
      )} networkFee but using user provided value of ${defaultNetworkFee}`
    );
  } else {
    transaction.networkFee = networkFeeEstimate;
  }
  console.log(
    `\u001b[32m  ✓ Network Fee set: ${transaction.networkFee.toDecimal(
      8
    )} \u001b[0m`
  );
}

async function checkSystemFee(client, transaction, fromAccount) {
  const invokeFunctionResponse = await client.invokeScript(
    u.HexString.fromHex(transaction.script),
    [
      {
        account: fromAccount.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ]
  );
  if (invokeFunctionResponse.state !== "HALT") {
    throw new Error(
      `Script errored out: ${invokeFunctionResponse.exception}`
    );
  }
  const requiredSystemFee = u.BigInteger.fromNumber(
    invokeFunctionResponse.gasconsumed
  );
  if (defaultSystemFee && requiredSystemFee.compare(defaultSystemFee) <= 0) {
    transaction.systemFee = u.BigInteger.fromNumber(defaultSystemFee);
    console.log(
      `  i Node indicates ${requiredSystemFee} systemFee but using user provided value of ${defaultSystemFee}`
    );
  } else {
    transaction.systemFee = requiredSystemFee;
  }
  console.log(
    `\u001b[32m  ✓ SystemFee set: ${transaction.systemFee.toDecimal(8)}\u001b[0m`
  );
}

async function getRoots() {
  const URL = "http://seed1t4.neo.org:20332";
  const client = new rpc.RPCClient(URL);
  // console.log(client)
  // console.log(await client.getBlockCount())
  const query = new rpc.Query({
    method: "invokefunction",
    params: ["0x50ac1c37690cc2cfc594472833cf57505d5f46de", "roots"],
  });
  const response = await client.execute(query);
  console.log(response);
}

async function isAvailable(name) {
  const URL = "http://seed1t4.neo.org:20332";
  const client = new rpc.RPCClient(URL);
  const query = new rpc.Query({
    method: "invokefunction",
    params: [
      "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
      "isAvailable",
      [{ type: "String", value: name }],
    ],
  });
  const response = await client.execute(query);
  console.log(response);
}

async function getPrice(client, contractAddress, length) {
  const query = new rpc.Query({
    method: "invokefunction",
    params: [
			contractAddress,
			'getPrice',
			[{ 'type': 'Integer', 'value': length }],
			[]
		],
  });
	const response = await client.execute(query);
  console.log(response);
}

async function register(rpcClient, account, domainName) {
  const script = sc.createScript({
		scriptHash: NS_CONTRACT_HASH,
		operation: 'register',
		args: [
			sc.ContractParam.string(domainName),
			sc.ContractParam.hash160(account.address)
		]
	})
	const currentHeight = await rpcClient.getBlockCount()
	console.log(`Current height: ${currentHeight}`)
	const transaction = new tx.Transaction({
		signers: [
			{
				account: account.scriptHash,
				scopes: tx.WitnessScope.CalledByEntry
			},
		],
		validUntilBlock: currentHeight + 1000,
		script: script
	})

  await checkNetworkFee(rpcClient, transaction)
  await checkSystemFee(rpcClient, transaction, account)
	const signedTransaction = transaction.sign(account, networkMagic)
	const result = await rpcClient.sendRawTransaction(u.HexString.fromHex(signedTransaction.serialize(true)).toBase64())
	console.log(`Transaction hash: ${result}`)
}

(async () => {
	const URL = 'http://seed1t4.neo.org:20332'
	const privateKey = '6PYKHzKbFK1Nv4fHgRFfrRbXQYXtX9okcmxi2sTGdLNEdf9vYMUnPfuTLp'
	const decryptedPrivateKey = await wallet.decrypt(privateKey, 'chibrituri')
	console.log(`Private key: ${decryptedPrivateKey}`)
	const account = new wallet.Account(decryptedPrivateKey)
	console.log(`Address: ${account.address} / 0x${account.scriptHash}`)
	const client = new rpc.RPCClient(URL)

	const domainName = 'cryptozombies.neo'
  // await getRoots();
  // await isAvailable(domainName);
  // await getPrice(client, contractAddress, domainName.length);
	await register(client, account, domainName)


})();
