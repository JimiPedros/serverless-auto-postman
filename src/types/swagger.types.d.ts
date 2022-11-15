import type { HttpMethod } from './common.types'

export interface Swagger {
  info: Info
  host: string
  basePath?: string
  tags?: Tag[]
  paths?: Paths
  securityDefinitions?: Record<string, SecurityDefinition>
  definitions?: Record<string, Definition>
  externalDocs?: ExternalDocs
  item: Array<Directory | Item>
}

export interface Directory {
  name: string
  item: Array<Directory | Item>
}

export interface Item {
  name: string
  request: Request
  response?: Response[]
}

export interface Response {
  name: string
  originalRequest: OriginalRequest
  status: string
  code: number
  _postman_previewlanguage: string
  header: any[]
  cookie: any[]
  body: string
}

export interface Header {
  key: string
  value: string
  type: string
  description?: string
}

export interface Body {
  mode: string
  raw: string
}

export interface Query {
  key: string
  value: string
  description?: string
}

export interface Url {
  raw: string
  protocol: string
  host: string[]
  path: string[]
  query: Query[]
}

export interface Request {
  method: string
  header?: Header[]
  body?: Body
  url: Url
  description?: string
}

export interface OriginalRequest {
  method: string
  header: Header[]
  body: Body
  url: Url
}

// Info Section
export interface Info {
  _postman_id?: string
  name?: string
  description?: string
  schema?: string
}


// Tag Section
export interface Tag {
  name: string
  description?: string
  externalDocs?: ExternalDocs
}

export interface Parameter {
  in: string
  name: string
  description?: string
  required?: boolean
  schema?: SchemaRef
  type?: string
}
export interface SchemaRef {
  $ref: string
}


type SecurityType = string
export type MethodSecurity = Record<SecurityType, string[]>

// Security Section
export interface SecurityDefinition {
  type: string
  name?: string
  in?: string
  authorizationUrl?: string
  flow?: string
  scopes?: Record<string, string>
}

// definition Section

export interface Definition {
  type?: string
  items?: { $ref: string }
  format?: Format
  default?: any
  description?: string
  required?: string[]
  additionalProperties?: boolean
  enum?: string[]
  properties?: Record<string, Definition>
  anyOf?: {
    const: string,
    type: string
  }[]
}
type Format = 'date-time' | 'int32' | 'int64'

export interface ExternalDocs {
  description: string
  url: string
}
