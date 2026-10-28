import { createMotor } from './precision-motors.js'
export const createModel = (options = {}) => createMotor('capcan', options)

