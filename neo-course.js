const { tx, wallet, CONST, rpc, sc, u } = require('@cityofzion/neon-core')
const { Command } = require('commander')

const defaultSystemFee = 0
const defaultNetworkFee = 0
const networkMagic = CONST.MAGIC_NUMBER.TestNet
const NS_CONTRACT_HASH = '50ac1c37690cc2cfc594472833cf57505d5f46de' // Name Service
const NS_CONTRACT_ADDRESS = "0x50ac1c37690cc2cfc594472833cf57505d5f46de"

const URL = process.env.URL
if (typeof URL === 'undefined') {
  console.log('The URL environment variable is not defined.')
  process.exit(1)
}

const privateKey = process.env.PRIVATE_KEY
if (typeof privateKey === 'undefined') {
  console.log('The PRIVATE_KEY environment variable is not defined.')
  process.exit(1)
}
const password = process.env.PASSWORD
if (typeof password === 'undefined') {
  console.log('The PASSWORD environment variable is not defined.')
  process.exit(1)
}

const recordTypes = {
  ipv4: 1,
  cn: 5,
  text: 16,
  ipv6: 28,
};

async function checkNetworkFee(client, transaction) {
  const feePerByteInvokeResponse = await client.invokeFunction(
    CONST.NATIVE_CONTRACT_HASH.PolicyContract,
    'getFeePerByte'
  )

  if (feePerByteInvokeResponse.state !== 'HALT') {
    if (defaultNetworkFee === 0) {
      throw new Error('Unable to retrieve data to calculate network fee.')
    } else {
      console.log(
        '\u001b[31m  ✗ Unable to get information to calculate network fee.  Using user provided value.\u001b[0m'
      );
      transaction.networkFee = u.BigInteger.fromNumber(defaultNetworkFee)
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
  )
}

async function checkSystemFee(client, transaction, fromAccount) {
  const invokeFunctionResponse = await client.invokeScript(
    u.HexString.fromHex(transaction.script),
    [
      {
        account: fromAccount.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry
      }
    ]
  )
  if (invokeFunctionResponse.state !== 'HALT') {
    throw new Error(`Script errored out: ${invokeFunctionResponse.exception}`)
  }
  const requiredSystemFee = u.BigInteger.fromNumber(
    invokeFunctionResponse.gasconsumed
  );
  if (defaultSystemFee && requiredSystemFee.compare(defaultSystemFee) <= 0) {
    transaction.systemFee = u.BigInteger.fromNumber(defaultSystemFee)
    console.log(
      `  i Node indicates ${requiredSystemFee} systemFee but using user provided value of ${defaultSystemFee}`
    );
  } else {
    transaction.systemFee = requiredSystemFee;
  }
  console.log(
    `\u001b[32m  ✓ SystemFee set: ${transaction.systemFee.toDecimal(
      8
    )}\u001b[0m`
  );
}

async function getRoots(rpcClient) {
  const query = new rpc.Query({
    method: "invokefunction",
    params: [NS_CONTRACT_ADDRESS, "roots"],
  })
  const response = await rpcClient.execute(query)
  const iteratorId = response.stack[0].id
  const sessionId = response.session
  return { iteratorId: iteratorId, sessionId: sessionId }
}

async function isAvailable(rpcClient, name) {
  const query = new rpc.Query({
    method: "invokefunction",
    params: [
      NS_CONTRACT_ADDRESS,
      "isAvailable",
      [{ type: "String", value: name }],
    ],
  })
  const response = await rpcClient.execute(query);
  if (response.exception != null) {
    console.log(response.exception);
    process.exit(0);
  }
  return response.stack[0].value;
}

async function getPrice(rpcClient, length) {
  const query = new rpc.Query({
    method: "invokefunction",
    params: [
      NS_CONTRACT_ADDRESS,
      "getPrice",
      [
        {
          type: "Integer",
          value: length,
        },
      ],
      [],
    ],
  })
  const response = await rpcClient.execute(query)
  return transformGasDecimal(response.stack[0].value)
}

async function register(rpcClient, account, domainName) {
  const script = sc.createScript({
    scriptHash: NS_CONTRACT_HASH,
    operation: "register",
    args: [
      sc.ContractParam.string(domainName),
      sc.ContractParam.hash160(account.address),
    ],
  })
  const currentHeight = await rpcClient.getBlockCount()
  console.log(`Current height: ${currentHeight}`)
  const transaction = new tx.Transaction({
    signers: [
      {
        account: account.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock: currentHeight + 1000,
    script: script,
  })

  await checkNetworkFee(rpcClient, transaction)
  await checkSystemFee(rpcClient, transaction, account)
  const signedTransaction = transaction.sign(account, networkMagic)
  const result = await rpcClient.sendRawTransaction(
    u.HexString.fromHex(signedTransaction.serialize(true)).toBase64()
  )
  console.log(`Transaction hash: ${result}`)
}

async function setRecord(rpcClient, account, domainName, type, value) {
  const script = sc.createScript({
    scriptHash: NS_CONTRACT_HASH,
    operation: "setRecord",
    args: [
      sc.ContractParam.string(domainName),
      sc.ContractParam.integer(type),
      sc.ContractParam.string(value),
    ],
  })
  const currentHeight = await rpcClient.getBlockCount()
  console.log(`Current height: ${currentHeight}`)
  const transaction = new tx.Transaction({
    signers: [
      {
        account: account.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock: currentHeight + 1000,
    script: script,
  })
  await checkNetworkFee(rpcClient, transaction)
  await checkSystemFee(rpcClient, transaction, account)
  const signedTransaction = transaction.sign(account, networkMagic)
  const result = await rpcClient.sendRawTransaction(
    u.HexString.fromHex(signedTransaction.serialize(true)).toBase64()
  )
  console.log(`Transaction hash: ${result}`)
}

async function renew(rpcClient, account, domainName, duration) {
  console.log(duration);
  const script = sc.createScript({
    scriptHash: NS_CONTRACT_HASH,
    operation: "renew",
    args: [
      sc.ContractParam.string(domainName),
      sc.ContractParam.integer(duration),
    ],
  })
  const currentHeight = await rpcClient.getBlockCount()
  console.log(`Current height: ${currentHeight}`)
  const transaction = new tx.Transaction({
    signers: [
      {
        account: account.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock: currentHeight + 1000,
    script: script,
  })
  await checkNetworkFee(rpcClient, transaction)
  await checkSystemFee(rpcClient, transaction, account)
  const signedTransaction = transaction.sign(account, networkMagic)
  const result = await rpcClient.sendRawTransaction(
    u.HexString.fromHex(signedTransaction.serialize(true)).toBase64()
  )
  console.log(`Transaction hash: ${result}`)
}

async function transfer(rpcClient, account, to, domainName, data) {
  const script = sc.createScript({
    scriptHash: NS_CONTRACT_HASH,
    operation: "transfer",
    args: [
      sc.ContractParam.hash160(to),
      sc.ContractParam.string(domainName),
      sc.ContractParam.string(data),
    ],
  })
  const currentHeight = await rpcClient.getBlockCount()
  console.log(`Current height: ${currentHeight}`)
  const transaction = new tx.Transaction({
    signers: [
      {
        account: account.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock: currentHeight + 1000,
    script: script,
  })
  await checkNetworkFee(rpcClient, transaction)
  await checkSystemFee(rpcClient, transaction, account)
  const signedTransaction = transaction.sign(account, networkMagic)
  const result = await rpcClient.sendRawTransaction(
    u.HexString.fromHex(signedTransaction.serialize(true)).toBase64()
  )
  console.log(`Transaction hash: ${result}`)
}

async function resolve(rpcClient, domainName, type) {
  const query = new rpc.Query({
    method: "invokefunction",
    params: [
      NS_CONTRACT_ADDRESS,
      "resolve",
      [
        {
          type: "String",
          value: domainName,
        },
        {
          type: "Integer",
          value: type,
        },
      ],
    ],
  })
  const response = await rpcClient.execute(query)
  return response
}

async function traverseIterator(rpcClient, sessionId, iteratorId, pageSize) {
  let response = []
  let iter = []
  do {
    iter = await rpcClient.traverseIterator(sessionId, iteratorId, pageSize)
    response.push(...iter)
    if (iter.length > 0) {
    }
  } while (iter.length > 0)
  return response
}

function base64hex2str(value) {
  return u.hexstring2str(u.base642hex(value))
}

function transformGasDecimal(num) {
  if (num.length <= 8) {
    return "0." + num.padStart(8, "0")
  }
  const decimalPoint = num.length - 8
  return (
    num.substring(0, decimalPoint) +
    "." +
    num.substring(decimalPoint, num.length)
  )
}

(async () => {
  const decryptedPrivateKey = await wallet.decrypt(privateKey, password)
  const account = new wallet.Account(decryptedPrivateKey)
  console.log(`Address: ${account.address} / 0x${account.scriptHash}`)
  const rpcClient = new rpc.RPCClient(URL)

  const program = new Command()
  program
    .name('nns-cli')
    .description('CLI for the Neo Name Service API')
    .version('0.0.1')

  program
    .command('get-roots')
    .description('Get roots')
    .action(async () => {
      const getRootsResponse = await getRoots(rpcClient)
      const iterableResponse = await traverseIterator(
        rpcClient,
        getRootsResponse.sessionId,
        getRootsResponse.iteratorId,
        10
      );
      for (item of iterableResponse) {
        console.log(base64hex2str(item.value))
      }
    })

  program
    .command('is-available')
    .description('Checks if a second-level domain is available')
    .argument('name', 'Domain name')
    .action(async (name) => {
      if (await isAvailable(rpcClient, name)) {
        console.log(`${name} is available`)
      } else {
        console.log(`${name} isn't available`)
      }
    })

  program
    .command('get-price')
    .description('Retrieves the price for registering a second-level domain.')
    .argument('name', 'Domain name')
    .action(async (name) => {
      console.log(
        `The price for registering ${name} is ${await getPrice(
          rpcClient,
          name.length
        )}`
      )
    })

  program
    .command('register')
    .description('Register a second-level domain')
    .argument('name', 'Domain name')
    .action(async (name) => {
      await register(rpcClient, account, name)
    })

  program
    .command('set-record')
    .description('Sets a record for a second-level domain or its subdomains.')
    .argument('name', 'Domain name')
    .argument('type', 'Type must be one of: ipv4, cn, text, and ipv6')
    .argument('data', 'The corresponding data')
    .action(async (name, type, data) => {
      await setRecord(rpcClient, account, name, recordTypes[type], data)
    })

  program
    .command('resolve')
    .description(
      'Retrieves the record of a second-level domain or its subdomains.'
    )
    .argument('name', 'Domain name')
    .argument('type', 'Type must be one of: ipv4, cn, text, or ipv6.')
    .action(async (name, type) => {
      const response = await resolve(rpcClient, name, recordTypes[type])
      console.log(base64hex2str(response.stack[0].value))
    })

  program
    .command('transfer')
    .description(
      'Transfers a domain from the owner address to another address.'
    )
    .argument('name', 'Domain name')
    .argument('to', 'The address to transfer to')
    .argument('data', 'The data information used after transfer.')
    .action(async (name, to, data) => {
      await transfer(rpcClient, account, to, name, data)
    })

  program.parse()
})()
