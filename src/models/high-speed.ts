import { createMotor } from './precision-motors.js'
export const createModel = (options = {}) => createMotor('high-speed', options)
