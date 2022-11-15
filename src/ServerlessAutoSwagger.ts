'use strict'
import { readFileSync } from 'fs-extra'
import type { Options } from 'serverless'
import type { Logging } from 'serverless/classes/Plugin'
import * as customPropertiesSchema from './schemas/custom-properties.schema.json'
import * as functionEventPropertiesSchema from './schemas/function-event-properties.schema.json'
import type { HttpMethod } from './types/common.types'
import type {
  CustomHttpApiEvent,
  CustomHttpEvent,
  CustomServerless,
  ServerlessCommand,
  ServerlessHooks,
} from './types/serverless-plugin.types'

import type {
  MethodSecurity,Swagger,
} from './types/swagger.types'

export default class ServerlessAutoSwagger {
  serverless: CustomServerless
  options: Options

  /**
   * Default properties set in Postman collection output.
   *
   * Use gatherSwaggerOverrides to override these properties.
   */
  swagger: Swagger = {
    item: [],
    host: "example.com",
    info: {
      _postman_id: "",
      name: "Postman collection",
      description: "",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    }
  }
  log: Logging['log']
  commands: Record<string, ServerlessCommand> = {}
  hooks: ServerlessHooks = {}

  /**
   * IO is only injected in Serverless v3.0.0 (can experiment
   * with `import { writeText, log, progress } from '@serverless/utils/log'
   * in a future PR)
   */
  constructor(serverless: CustomServerless, options: Options, io?: Logging) {
    this.serverless = serverless
    this.options = options

    if (io?.log) {
      this.log = io.log
    } else {
      this.log = {
        notice: this.serverless.cli?.log ?? console.log,
        error: console.error,
      } as Logging['log']
    }

    this.registerOptions()

    this.commands = {
      'generate-postman': {
        usage: 'Generates Postman collection for your API',
        lifecycleEvents: ['generateCollection'],
      },
    }

    this.hooks = {
      'generate-postman:generateCollection': this.generateCollection,
    }
  }

  registerOptions = () => {
    // TODO: Test custom properties configuration
    this.serverless.configSchemaHandler?.defineCustomProperties(customPropertiesSchema)
    this.serverless.configSchemaHandler?.defineFunctionEventProperties('aws', 'http', functionEventPropertiesSchema)
    this.serverless.configSchemaHandler?.defineFunctionEventProperties('aws', 'httpApi', functionEventPropertiesSchema)
  }

  /**
   * Updates this.swagger with serverless custom.autoswagger overrides
   */
  gatherSwaggerOverrides = (): void => {
    const p = this.serverless.service.custom?.postman ?? {}
    if (p.host) this.swagger.host = p.host
    if (p.title) this.swagger.info.name = p.name
    if (p.description) this.swagger.info.description = p.description
    if (p.schema) this.swagger.info.schema = p.schema
  }

  /**
   * Generate Postman collection in JSON format
   */
  generateCollection = async () => {
    this.gatherSwaggerOverrides()
    this.processFunctions()
    this.log.notice('Generating Postman collection..')
    console.log(JSON.stringify(this.swagger))
  }

  // addSwaggerPath = (functionName: string, http: CustomHttpEvent | CustomHttpApiEvent | string) => {
  //   if (typeof http === 'string') {
  //     // TODO they're using the shorthand - parse that into object.
  //     //  You'll also have to remove the `typeof http !== 'string'` check from the function calling this one
  //     return
  //   }
  //
  //   let path = http.path
  //   if (path[0] !== '/') path = `/${path}`
  //   this.swagger.paths[path] ??= {}
  //
  //   const method = http.method.toLowerCase() as Lowercase<HttpMethod>
  //
  //   this.swagger.paths[path][method] = {
  //     summary: http.summary || functionName,
  //     description: http.description ?? '',
  //     tags: http.swaggerTags,
  //     operationId: `${functionName}.${method}.${http.path}`,
  //     consumes: http.consumes ?? ['application/json'],
  //     produces: http.produces ?? ['application/json'],
  //     // This is actually type `HttpEvent | HttpApiEvent`, but we can lie since only HttpEvent params (or shared params) are used
  //     parameters: this.httpEventToParameters(http as CustomHttpEvent),
  //     responses: this.formatResponses(http.responseData ?? http.responses),
  //   }
  //
  //   const apiKeyHeaders = this.serverless.service.custom?.autoswagger?.apiKeyHeaders
  //
  //   const security: MethodSecurity[] = []
  //
  //   if (apiKeyHeaders?.length) {
  //     security.push(
  //       apiKeyHeaders.reduce((acc, indexName: string) => ({ ...acc, [indexName]: [] }), {} as MethodSecurity)
  //     )
  //   }
  //
  //   if (security.length) {
  //     this.swagger.paths[path][method]!.security = security
  //   }
  // }

  processEvent = (functionName: string, http: CustomHttpEvent | CustomHttpApiEvent | string) => {
    if (typeof http === 'string') {
      // TODO they're using the shorthand - parse that into object.
      //  You'll also have to remove the `typeof http !== 'string'` check from the function calling this one
      return
    }

    this.swagger.item ??= []

    const { summary, method, path, description } = http

    //   {
    //   summary: http.summary || functionName,
    //   description: http.description ?? '',
    //   operationId: `${functionName}.${method}.${http.path}`,
    //   consumes: http.consumes ?? ['application/json'],
    //   produces: http.produces ?? ['application/json'],
    //   // This is actually type `HttpEvent | HttpApiEvent`, but we can lie since only HttpEvent params (or shared params) are used
    //   parameters: this.httpEventToParameters(http as CustomHttpEvent),
    //   responses: this.formatResponses(http.responseData ?? http.responses),
    // }

    let header = []

    if (http.consumes) {
      header.push(
          ...http.consumes.map(value => ({
          key: 'Content-Type',
          value: value,
          type: 'text',
        }))
      )
    }

    if (http.authorization) {
      header.push({
        key: 'Authorization',
        value: 'Token {{token}}',
        type: 'text',
      })
    }

    let query: { key: string; value: string }[] = []

    // @ts-ignore
    if (http.request?.parameters?.querystrings) {
      // @ts-ignore
      query = Object.entries(http.request.parameters.querystrings).map(query => ({
        key: query[0],
        value: ""
      }))
    }

    this.swagger.item.push(
      {
        name: summary || functionName,
        request: {
          method: method.toUpperCase() as Uppercase<HttpMethod>,
          header: header,
          url: {
            protocol: 'https',
            raw: this.swagger.host + path,
            host: [this.swagger.host],
            path: path.split('/'),
            query: query
          },
          description: description ?? '',
        }
      }
    )

    const apiKeyHeaders = this.serverless.service.custom?.autoswagger?.apiKeyHeaders

    const security: MethodSecurity[] = []

    if (apiKeyHeaders?.length) {
      security.push(
        apiKeyHeaders.reduce((acc, indexName: string) => ({ ...acc, [indexName]: [] }), {} as MethodSecurity)
      )
    }
  }

  /**
   * Processes the class instance functions
   */
  processFunctions = () => {
    const functions = this.serverless.service.functions ?? {}
    Object.entries(functions).forEach(([functionName, config]) => {
      const events = config.events ?? []
      events
        .map((event) => event.http || event.httpApi)
        .filter((http) => !!http && typeof http !== 'string' && !http.exclude)
        .forEach((http) => this.processEvent(functionName, http!))
    })
  }

  // formatResponses = (responseData: HttpResponses | undefined) => {
  //   if (!responseData) {
  //     // could throw error
  //     return { 200: { description: '200 response' } }
  //   }
  //   const formatted: Record<string, Response> = {}
  //   Object.entries(responseData).forEach(([statusCode, responseDetails]) => {
  //     if (typeof responseDetails == 'string') {
  //       formatted[statusCode] = {
  //         description: responseDetails,
  //       }
  //       return
  //     }
  //     const response: Response = { description: responseDetails.description || `${statusCode} response` }
  //     if (responseDetails.bodyType) {
  //       response.schema = { $ref: `#/definitions/${responseDetails.bodyType}` }
  //     }
  //
  //     formatted[statusCode] = response
  //   })
  //
  //   return formatted
  // }

  // The arg is actually type `HttpEvent | HttpApiEvent`, but we only use it if it has httpEvent props (or shared props),
  //  so we can lie to the compiler to make typing simpler
  // httpEventToParameters = (httpEvent: CustomHttpEvent): Parameter[] => {
  //
  //   const parameters: Parameter[] = []
  //
  //   if (httpEvent.bodyType) {
  //     parameters.push({
  //       in: 'body',
  //       name: 'body',
  //       description: 'Body required in the request',
  //       required: true,
  //       schema: { $ref: `#/definitions/${httpEvent.bodyType}` },
  //     })
  //   }
  //
  //   const rawPathParams: PathParameters['path'] = httpEvent.request?.parameters?.paths
  //   const match = httpEvent.path.match(/[^{}]+(?=})/g)
  //   let pathParameters = match ?? []
  //
  //   if (rawPathParams) {
  //     Object.entries(rawPathParams ?? {}).forEach(([param, paramInfo]) => {
  //       parameters.push(this.pathToParam(param, paramInfo))
  //       pathParameters = removeStringFromArray(pathParameters, param)
  //     })
  //   }
  //
  //   // If no match, will just be [] anyway
  //   pathParameters.forEach((param: string) => parameters.push(this.pathToParam(param)))
  //
  //   if (httpEvent.headerParameters || httpEvent.request?.parameters?.headers) {
  //     // If no headerParameters are provided, try to use the builtin headers
  //     const rawHeaderParams: HeaderParameters =
  //       httpEvent.headerParameters ??
  //       Object.entries(httpEvent.request!.parameters!.headers!).reduce(
  //         (acc, [name, required]) => ({ ...acc, [name]: { required, type: 'string' } }),
  //         {}
  //       )
  //
  //     Object.entries(rawHeaderParams).forEach(([param, data]) => {
  //       parameters.push({
  //         in: 'header',
  //         name: param,
  //         required: data.required ?? false,
  //         type: data.type ?? 'string',
  //         description: data.description,
  //       })
  //     })
  //   }
  //
  //   if (httpEvent.queryStringParameters || httpEvent.request?.parameters?.querystrings) {
  //     // If no queryStringParameters are provided, try to use the builtin query strings
  //     const rawQueryParams: QueryStringParameters =
  //       httpEvent.queryStringParameters ??
  //       Object.entries(httpEvent.request!.parameters!.querystrings!).reduce(
  //         (acc, [name, required]) => ({ ...acc, [name]: { required, type: 'string' } }),
  //         {}
  //       )
  //
  //     Object.entries(rawQueryParams).forEach(([param, data]) => {
  //       parameters.push({
  //         in: 'query',
  //         name: param,
  //         type: data.type ?? 'string',
  //         description: data.description,
  //         required: data.required ?? false,
  //         ...(data.type === 'array'
  //           ? {
  //               items: { type: data.arrayItemsType },
  //               collectionFormat: 'multi',
  //             }
  //           : {}),
  //       })
  //     })
  //   }
  //
  //   return parameters
  // }
}
