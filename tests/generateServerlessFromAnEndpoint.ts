import {CustomServerless, ServerlessConfig, ServerlessFunctionEvent} from "../src/types/serverless-plugin.types"

export const generateServerlessFromAnEndpoint = (events: ServerlessFunctionEvent[], options = {}): CustomServerless => {
    const serviceDetails: ServerlessConfig = {
        service: '',
        provider: {
            name: 'aws',
            runtime: undefined,
            stage: '',
            region: undefined,
            profile: '',
            environment: {},
        },
        plugins: [],
        functions: {
            mockedFunction: {
                handler: 'mockedFunction.handler',
                events,
            },
        },
        custom: {
            autoswagger: options,
        },
    }

    return {
        service: serviceDetails,
        configurationInput: serviceDetails,
        configSchemaHandler: {
            defineCustomProperties: () => undefined,
            defineFunctionEvent: () => undefined,
            defineFunctionEventProperties: () => undefined,
            defineFunctionProperties: () => undefined,
            defineProvider: () => undefined,
            defineTopLevelProperty: () => undefined,
        },
    }
}