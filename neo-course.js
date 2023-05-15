const { tx, wallet, CONST, rpc, sc, u } = require("@cityofzion/neon-core")

const systemFee = 20000000
const networkFee = 20000000
const networkMagic = 894710606 //TestNet


async function checkSystemFee() {
  const invokeFunctionResponse = await rpcClient.invokeScript(
    u.HexString.fromHex(vars.tx.script),
    [
      {
        account: inputs.fromAccount.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ]
  );
  if (invokeFunctionResponse.state !== "HALT") {
    throw new Error(
      `Transfer script errored out: ${invokeFunctionResponse.exception}`
    );
  }
  const requiredSystemFee = u.BigInteger.fromNumber(
    invokeFunctionResponse.gasconsumed
  );
  if (inputs.systemFee && inputs.systemFee >= requiredSystemFee) {
    vars.tx.systemFee = u.BigInteger.fromNumber(inputs.systemFee);
    console.log(
      `  i Node indicates ${requiredSystemFee} systemFee but using user provided value of ${inputs.systemFee}`
    );
  } else {
    vars.tx.systemFee = requiredSystemFee;
  }
  console.log(
    `\u001b[32m  ✓ SystemFee set: ${vars.tx.systemFee.toDecimal(8)}\u001b[0m`
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
async function register(rpcClient, account, contractAddress, domainName) {
	// const script = sc.createScript({
	// 	scriptHash: contractAddress,
	// 	operation: 'invokefunction',
		
	// })
	// const transaction = new tx.Transaction()
	// transaction.addSigner(new tx.Signer({ account: account.scriptHash }))
	// transaction.sign(account)
	// console.log(transaction.hash())
	// const inputs = {
	// 	name: domainName,
	// 	owner: contractAddress,
	// }
	const script = sc.createScript({
		scriptHash: u.hash160(contractAddress),
		operation: 'invokefunction',
		args: [
			sc.ContractParam.string(domainName),
			account.address
		]
	})
	const currentHeight = await rpcClient.getBlockCount()
	console.log(`Current height: ${currentHeight}`)
	const transaction =  new tx.Transaction({
		signers: [
			{
				account: account.scriptHash,
				scopes: tx.WitnessScope.CalledByEntry
			},
		],
		validUntilBlock: currentHeight + 1000,
		script: script
	})

	tx.networkFee = u.BigInteger.fromNumber(networkFee)
	tx.systemFee = u.BigInteger.fromNumber(systemFee)
	const signedTransaction = transaction.sign(account, networkMagic)
	const result = await rpcClient.sendRawTransaction(u.HexString.fromHex(signedTransaction.serialize(true)).toBase64())
	console.log(`Transaction hash: %{result}`)

}

(async () => {
	const URL = 'http://seed1t4.neo.org:20332'
	const contractAddress = '0x50ac1c37690cc2cfc594472833cf57505d5f46de'
	const privateKey = '6PYKHzKbFK1Nv4fHgRFfrRbXQYXtX9okcmxi2sTGdLNEdf9vYMUnPfuTLp'
	const decryptedPrivateKey = await wallet.decrypt(privateKey, 'chibrituri')
	console.log(`Private key: ${decryptedPrivateKey}`)
	const account = new wallet.Account(decryptedPrivateKey)
	console.log(`Address: ${account.address}`)
	const client = new rpc.RPCClient(URL)

	const domainName = 'cryptozombies.neo'
  // await getRoots();
  // await isAvailable(domainName);
  // await getPrice(client, contractAddress, domainName.length);
	await register(client, account, contractAddress, domainName)


})();
