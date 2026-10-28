import spec from './specs/capcan.json'
import { createCatalogueModel } from './catalogue-model.js'
export const createModel = () => createCatalogueModel(spec, 'capcan')

