const instance_skel = require('../../instance_skel')
const bent = require('bent')

class instance extends instance_skel {
	/**
	 * Create an instance of the module
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.0.0
	 */

	constructor(system, id, config) {
		super(system, id, config)
	}

	init() {
		const tThis = this

		this.actions() // export actions
		this.variables()
		this.initPresets()
		this.status(this.STATUS_WARNING, 'Connecting')
		this.isReady = false
		this.vardefs = []
		if (this.config.host != undefined) {
			// this.log("info", 'Connecting to ' + this.config["host"] + ':' + this.config["port"])
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/list', 'json')().then(
				function handleList(body) {
					tThis.status(tThis.STATUS_OK, 'Connected')
					tThis.log('Connected to ' + tThis.config.host)
					tThis.isReady = true
				}
			)
		}
		this.variables()
		this.intervalId = setInterval(function handleInterval() {
			tThis.log('info', 'Updating variables')
			// console.log("!!!!!!!!!!!!!!!!!!!!!!! UPDATEINGINI")
			tThis.updateVariables()
		}, this.config.refreshTime)
	}

	async retrieveSound() {
		const tTemp = this
		if (this.config.host != undefined) {
			const body = await bent(
				'GET',
				200,
				'http://' + this.config.host + ':' + this.config['port'] + '/v1/list',
				'json'
			)()
			const namesAndValues = []
			tTemp.status(this.STATUS_OK, 'Connected')
			tTemp.log('Connected to ' + this.config.host)
			tTemp.log(body)
			for (var i = 0; i < body.length; i++) {
				namesAndValues.push({ id: body[i][1], label: body[i][0] })
			}
			return namesAndValues
		} else {
			return []
		}
	}

	checkConnection() {
		if (this.isReady) {
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/list', 'json')()
				.then(function handleList(body) {
					tThis.status(tThis.STATUS_OK, 'Connected')
				})
				.catch(function handleError(err) {
					tThis.status(tThis.STATUS_ERROR, 'Not connected (Failed)')
				})
		}
	}

	updateVariables() {
		const tThis = this
		if (this.isReady) {
			this.vardefs.forEach(function handleList(item) {
				if (item.name != "amount_sounds_currently_playing") {
					let idT = item.name.split("_")[1]
					bent('GET', 200, 'http://' + tThis.config.host + ':' + tThis.config['port'] + '/v1/remaining?id=' + idT, 'json')().then(
						function handleList(body) {
							tThis.status(tThis.STATUS_OK, 'Connected')
							tThis.setVariable('sound_' + body.id + "_remaining_time", body.RemaningSec)
							// console.log(Object.keys(body).length)
						}
					)
				}
			})
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/current', 'json')().then(
				function handleList(body) {
					tThis.status(tThis.STATUS_OK, 'Connected')
					tThis.setVariable('amount_sounds_currently_playing', String(Object.keys(body).length))
					// console.log(Object.keys(body).length)
				}
			)
		}
	}

	variables() {
		const tThis = this
		try {
			const variables = []
			if (this.config.soundsToMonitor != undefined && this.config.soundsToMonitor.length > 0) {
				var listy = (this.config.soundsToMonitor + ",").split(",")
				listy.forEach(function handleList(item) {
					variables.push({
						label: 'Sound ' + item + ' remaining time',
						name: 'sound_' + item + '_remaining_time'
					})
				})
			}
			console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!" + variables)

			variables.push({
				name: 'amount_sounds_currently_playing',
				label: 'Songs currently playing',
			})
			this.setVariableDefinitions(variables)
			variables.forEach(function handleList(item) {
				tThis.setVariable(item.name, '0')
			})
			this.vardefs = variables
			// this.setVariable('amount_sounds_currently_playing', '0')
		} catch (error) {
			console.error(error)
		}

	}

	async actions() {
		const optis = await this.retrieveSound()
		this.setActions({
			stopAll: {
				label: 'Stop all sounds',
			},
			bufferAll: {
				label: 'Buffer all sounds',
			},
			stop: {
				label: 'Stop sound',
				options: [
					{
						type: 'number',
						label: 'Sound ID',
						id: 'id',
						min: 0,
						required: true,
						tooltip: 'The ID of the sound to stop',
					}
				]
			}, 
			play: {
				label: 'Play sound',
				options: [
					{
						type: 'dropdown',
						label: 'Select a sound',
						id: 'soundDropdown',
						default: 0,
						tooltip: 'Please select a sound to be played',
						choices: optis,
						minChoicesForSearch: 0,
					},
					{
						type: 'checkbox',
						label: 'Loop',
						id: 'soundLoop',
						default: false,
						tooltip: 'Loop the audio or not',
					},
					{
						type: 'number',
						label: 'Vanity Id / Nickname',
						id: 'vanityId',
						default: -1,
						tooltip: 'The vanityId of the sound, -1 to disable it.',
					}
				],
			},
		})
	}

	initPresets() {
		var presets = []

		presets.push({
			category: 'Group Controls',
			label: '',
			bank: {
				style: 'text',
				text: 'Stop all sounds',
				size: '18',
				color: '16777215',
			},
			actions: [
				{
					action: 'stopAll'
				},
			]
		})

		presets.push({
			category: 'Group Controls',
			label: '',
			bank: {
				style: 'text',
				text: 'Buffer all sounds',
				size: '18',
				color: '16777215',
			},
			actions: [
				{
					action: 'bufferAll'
				},
			]
		})


		this.setPresetDefinitions(presets)
	}

	config_fields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				regex: this.REGEX_IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				default: 4449,
				regex: this.REGEX_PORT,
			},
			{
				type: 'number',
				id: 'refreshTime',
				label: 'Update interval',
				width: 4,
				default: 1000,
			},
			{
				type: 'textinput',
				id: 'soundsToMonitor',
				label: 'Sounds to monitor (enter a comma separated list)',
				width: 12,
			}
		]
	}

	updateConfig(config) {
		tThis = this
		this.config = config
		const tThis = this
		this.isReady = false
		this.status(this.STATUS_WARNING, 'Connecting')
		if (this.config.host != undefined && this.config.port != undefined) {
			this.log('info', 'Connecting to http://' + this.config['host'] + ':' + this.config['port'])
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/list', 'json')().then(
				function handleList(body) {
					tThis.status(tThis.STATUS_OK, 'Connected')
					tThis.log('Connected to ' + this.config.host)
					tThis.log(body)
					tThis.isReady = true
				}
			)
		}
	}

	action(action) {
		const tTemp = this
		if (this.isReady) {
			if (action.action == 'stopAll') {
				bent('GET', 200, 'http://' + tTemp.config.host + ':' + tTemp.config['port'] + '/v1/stopAll', 'json')().then(
					function handleList(body) {
						tTemp.status(tTemp.STATUS_OK, 'Connected')
						tTemp.log('Connected to ' + tTemp.config.host)
						tTemp.log(body)
					}
				)
				return
			} else if (action.action == 'bufferAll') {
				bent('GET', 200, 'http://' + tTemp.config.host + ':' + tTemp.config['port'] + '/v1/bufferAll', 'json')().then(
					function handleList(body) {
						tTemp.status(tTemp.STATUS_OK, 'Connected')
						tTemp.log('Connected to ' + tTemp.config.host)
						tTemp.log(body)
					}
				)
			}  else if (action.action == 'stop') {
				bent('GET', 200, 'http://' + tTemp.config.host + ':' + tTemp.config['port'] + '/v1/stop?id=' + action.options["id"], 'json')().then(
					function handleList(body) {
						tTemp.status(tTemp.STATUS_OK, 'Connected')
						tTemp.log('Connected to ' + tTemp.config.host)
						tTemp.log(body)
					}
				)
			} else if (action.action == 'play') {
				let appendix = ""
				console.log(action.options["vanityId"])
				if (action.options["vanityId"] != -1 && action.options["vanityId"] != undefined) {
					appendix = "&id=" + action.options["vanityId"]
				}
				try {
					console.log("????????" + appendix)
					var url = 'http://' +
						this.config.host +
						':' +
						this.config['port'] +
						'/v1/play?file=' +
						action.options['soundDropdown'] +
						'&loop=' +
						action.options['soundLoop'] + appendix
					console.log("!!!!!!!!!!" + url)
					bent(
						'GET',
						200,
						url,
						'json'
					)().then(function handleList(body) {
						tTemp.status(tTemp.STATUS_OK, 'Connected')
						tTemp.log('Connected to ' + tTemp.config.host)
						tTemp.log(body)
					})
				} catch (error) {
					console.log(error)
				}

			}
			this.updateVariables()
		}
	}

	destroy() {
		clearInterval(this.intervalId)
		this.debug('destroy')
	}
}
exports = module.exports = instance
