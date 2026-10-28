import spec from './specs/pump.json'
import { createCatalogueModel } from './catalogue-model.js'
export const createModel = () => createCatalogueModel(spec, 'pump')

