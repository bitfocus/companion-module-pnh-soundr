const bent = require('bent')
const { InstanceStatus, InstanceBase, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')

class SoundrInstance extends InstanceBase {

	constructor(internal) {
		super(internal)
		this.vardefs = [];
	}

	async init(config) {
		const tThis = this
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		this.log("info", "Exporting actions")
		this.updateActions() // export actions
		this.variables()
		this.initPresets()

		this.isReady = true

		this.intervalId = setInterval(function handleInterval() {
			tThis.log('info', 'Updating variables')
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
			tTemp.updateStatus(InstanceStatus.Ok)
			tTemp.log("info", 'Connected to ' + this.config.host)
			tTemp.log(body)
			for (var i = 0; i < body.length; i++) {
				namesAndValues.push({ id: body[i][1], label: body[i][0] })
			}
			return namesAndValues
		} else {
			return []
		}
	}

	updateVariables() {
		const tThis = this
		if (this.isReady) {
			this.log('info', 'Updating variables')
			
			this.vardefs.forEach(function handleList(item) {
				if (item.variableId != "amount_sounds_currently_playing") {
					let idT = item.variableId.split("_")[1]
					console.log("debug", "Checking ID " + idT + " remaining time")
					bent('GET', 200, 'http://' + tThis.config.host + ':' + tThis.config['port'] + '/v1/remaining?id=' + idT, 'json')().then(
						function handleList(body) {
							let updates = {}
							tThis.updateStatus(InstanceStatus.Ok)
							//tThis.setVariableValues({('sound_' + body.id + "_remaining_time") = body.RemaningSec})
							updates["sound_" + body.id + "_remaining_time"] = String(body.RemaningSec)
							tThis.setVariableValues(updates)
						}
					)
				}
			})
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/current', 'json')().then(
				function handleList(body) {
					tThis.updateStatus(InstanceStatus.Ok)
					let updates = {}
					updates["amount_sounds_currently_playing"] = String(Object.keys(body).length)
					tThis.setVariableValues(updates)
				}
			)
		}
	}

	variables() {
		const tThis = this
		const VarDefs = []
		if (this.config.soundsToMonitor != undefined && this.config.soundsToMonitor.length > 0) {
			var listy = (this.config.soundsToMonitor + ",").split(",")
			listy.forEach(function handleList(item) {
				VarDefs.push({
					name: 'Sound ' + item + ' remaining time',
					variableId: 'sound_' + item + '_remaining_time'
				})
			})
		}

		VarDefs.push({
			name: 'Songs currently playing',
			variableId: 'amount_sounds_currently_playing',
		})
		this.vardefs = VarDefs

		this.setVariableDefinitions(VarDefs)

		const newVariables = {}

		VarDefs.forEach(function handleList(item) {
			newVariables[item.variableId] = '0'
		})
		this.setVariableValues(newVariables)



	}

	async updateActions() {
		const optis = await this.retrieveSound()
		this.setActionDefinitions({
			stopAll: {
				name: 'Stop all sounds',
				callback: async (action) => {
					this.log('info', 'Stopping all sounds')
					bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/stopAll', 'json')()
				},
				options: []
			},
			bufferAll: {
				name: 'Buffer all sounds',
				callback: (action) => {
					bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/bufferAll', 'json')()
				},
				options: []
			},
			stop: {
				name: 'Stop sound',
				options: [
					{
						type: 'number',
						label: 'Sound ID',
						id: 'id',
						min: 0,
						required: true,
						tooltip: 'The ID of the sound to stop',
					}
				],
				callback: (action) => {
					this.log('info', 'Stopping sound ' + action.options.id)
					bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/stop?id=' + action.options.id, 'json')()
				}
			},
			play: {
				name: 'Play sound',
				options: [
					{
						type: 'dropdown',
						label: 'Select a sound',
						id: 'soundDropdown',
						default: 0,
						tooltip: 'Please select a sound to be played',
						choices: optis,
						//choices: [],
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
				callback: (action) => {
					this.log('info', 'Playing sound ' + action.options.soundDropdown + " on http://" + this.config.host + ':' + this.config['port'] + '/v1/play?file=' + action.options.soundDropdown + '&loop=' + action.options.soundLoop + '&vanityId=' + action.options.vanityId)
					bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/play?file=' + action.options.soundDropdown + '&loop=' + action.options.soundLoop + '&vanityId=' + action.options.vanityId, 'json')()
				}
			},
		})
	}

	initPresets() {
		var presets = {}

		presets ["stop_all"] = {
			category: 'Group Controls',
			label: '',
			type: "button",
			name: "Stop all sounds",
			style: {
				style: 'text',
				text: 'Stop all sounds',
				size: 'auto',
				color: '16777215',
			},
			steps: [
				{
					down: [
						{
							// add an action on down press
							actionId: 'stopAll',
							options: {
								
							},
						},
					],
				},
			],
			feedbacks: []
		}

		presets["buffer_all"] = {
			category: 'Group Controls',
			type: "button",
			name: "Buffer all sounds",
			label: '',
			style: {
				style: 'text',
				text: 'Buffer all sounds',
				size: 'auto',
				color: '16777215',
			},
			steps: [
				{
					down: [
						{
							// add an action on down press
							actionId: 'bufferAll',
							options: {
								
							},
						},
					],
				},
			],
			feedbacks: []
		}


		this.setPresetDefinitions(presets)
	}

	getConfigFields() {
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

	async configUpdated(config) {
		tThis = this
		this.config = config
		this.isReady = false
		this.log('info', 'Config updated, connecting to ' + this.config.host + ':' + this.config.port)
		this.updateStatus(InstanceStatus.Connecting)
		if (this.config.host != undefined && this.config.port != undefined) {
			this.log('info', 'Connecting to http://' + this.config['host'] + ':' + this.config['port'])
			bent('GET', 200, 'http://' + this.config.host + ':' + this.config['port'] + '/v1/list', 'json')().then(
				function handleList(body) {
					tThis.updateStatus(InstanceStatus.Ok)
					tThis.log('Connected to ' + this.config.host)
					tThis.log(body)
					tThis.isReady = true
				}
			).catch(function handleFail(reason) {
				tThis.updateStatus(InstanceStatus.ConnectionFailure)
				tThis.log('error', 'Failed to connect to ' + this.config.host + ' - ' + reason)
			})
		} else {
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}

	async destroy() {
		clearInterval(this.intervalId)
		this.debug('destroy')
	}
}

runEntrypoint(SoundrInstance, UpgradeScripts)