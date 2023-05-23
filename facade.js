import Neon from "@cityofzion/neon-js"

const NS_CONTRACT_HASH = '50ac1c37690cc2cfc594472833cf57505d5f46de'
const url = 'http://seed1t4.neo.org:20332'

const networkMagic = Neon.CONST.MAGIC_NUMBER.TestNet

async function getRoots(facade) {
	console.log('-> getRoots')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'roots',
		args: []
	}
	const response = await facade.invoke(props)
	console.log(response)
	const iteratorId = response.stack[0].id
	const sessionId = response.session
	console.log(`Iterator ID: ${iteratorId}`)
	console.log(`Session ID:  ${sessionId}`)
	console.log(' <- getRoots')
	return {iteratorId: iteratorId, sessionId: sessionId}
}

async function isAvailable(facade, domainName) {
	console.log('-> isAvailable')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'isAvailable',
		args: [
			Neon.sc.ContractParam.string(domainName)
		]
	}
	const response = await facade.invoke(props)
	console.log(response)
	console.log(' <- isAvailable')
}



async function getPrice(facade, length) {
	console.log('-> getPrice')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'getPrice',
		args: [
			Neon.sc.ContractParam.integer(length)
		]
	}
	const response = await facade.invoke(props)
	console.log(response)
	console.log(' <- getPrice')
}


async function register(facade, signingConfig, address, domainName) {
	console.log('-> register')
	const intent  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'register',
		args: [
			Neon.sc.ContractParam.hash160(address),
			Neon.sc.ContractParam.string(domainName)
		]
	}
	const response = await facade.invoke([intent], signingConfig)
	console.log(response)
	console.log(' <- register')
}

async function tokensOf(facade, address) {
	console.log('-> tokensOf')
	console.log(`Address: ${address}`)
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'tokensOf',
		args: [
			Neon.sc.ContractParam.hash160(address)
		]
	}
	const response = await facade.invoke(props)
	console.log(response)
	console.log(' <- tokensOf')
}

async function getAllRecords(facade, domainName) {
	console.log('-> getAllRecords')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'getAllRecords',
		args: [
			Neon.sc.ContractParam.string(domainName)
		]
	}
	const response = await facade.invoke(props)
	console.log(response)
	const iteratorId = response.stack[0].id
	const sessionId = response.session
	console.log(`Iterator ID: ${iteratorId}`)
	console.log(`Session ID:  ${sessionId}`)
	console.log(' <- getAllRecords')
	return {iteratorId: iteratorId, sessionId: sessionId}
}

async function getRecord (facade, domainName, type) {
	console.log('-> getRecord')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'getRecord',
		args: [
			Neon.sc.ContractParam.string(domainName),
			Neon.sc.ContractParam.integer(type)
		]
	}
	const response = await facade.invoke(props)
	console.log(response)
	console.log(' <- getRecord')
}

async function traverseIterator (sessionId, iteratorId, pageSize) {
	console.log('-> traverseIterator')
	const client = new Neon.rpc.RPCClient(url);
	const response = await client.traverseIterator(sessionId, iteratorId, pageSize)
	console.log(' <- traverseIterator')
	return response
}

async function setRecord (facade, signingConfig, name, type, data) {
	console.log('-> setRecord')
	const props  = {
		scriptHash: NS_CONTRACT_HASH,
		operation: 'setRecord',
		args: [
			Neon.sc.ContractParam.string(name),
			Neon.sc.ContractParam.integer(type),
			Neon.sc.ContractParam.string(data)
		]
	}
	const response = await facade.invoke(props, signingConfig)
	console.log(response)
	console.log(' <- setRecord')
}

function base64hex2str(value) {
	return Neon.u.hexstring2str(Neon.u.base642hex(value))
}

(async () => {

	const privateKey = "KxbmgmeN7NyRBBkgcZHmSKrpvx5bTxJq3xL99QLvbQ6rsyWgX2xv"
	const address = 'NM2fcN1CyU5LMxjV4CpD3fBausxfX2tnvM'
	const facade = await Neon.api.NetworkFacade.fromConfig({
		node: url,
	})
	
	const account = new Neon.wallet.Account(privateKey)
	// console.log(facade)
	const signingConfig = {
		signingCallback: Neon.api.signWithAccount(
			new Neon.wallet.Account(privateKey)
		),
	}
	const type = 1
	const ip = '1.2.3.4'
	const domainName = 'cryptozombies11.neo'
	// console.log(signingConfig)
	// const getRootsResponse = await getRoots(facade)
	// const response = await traverseIterator(getRootsResponse.sessionId, getRootsResponse.iteratorId, 10)
	// console.log(response)
	// const val = response[0].value
	// console.log(base64hex2str(val))
	// const hexValue = Neon.u.base642hex(val)
	// console.log(Neon.u.hexstring2str(hexValue))
	// await traverseIterator(facade, getRootsResponse)
	// await isAvailable(facade, domainName)
	// await getPrice(facade, domainName.length)
	await register(facade, signingConfig, account.address, domainName)
	// const response = await getAllRecords(facade, domainName)
	// await traverseIterator(response.sessionId, response.iteratorId)
	// await setRecord(facade, signingConfig, domainName, type, ip)
})()