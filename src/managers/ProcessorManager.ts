import * as logging from 'common/logging';

import { Processor } from '../interfaces';
import ProcessorModel from '../models/Processor';
import { UpdateQuery } from 'mongoose';

export const update = async (processorId: string, data: Partial<Processor>) => {
  logging.debug(`update processor ${processorId} with ${JSON.stringify(data)}`);
  try {
    const update: UpdateQuery<Processor> = { $addToSet: {} };
    update.$set = { ...data, updatedAt: new Date() };
    update.$setOnInsert = { createdAt: new Date() };
    await ProcessorModel.findOneAndUpdate({ _id: processorId }, update, {
      upsert: true,
      new: true,
    });
  } catch (e) {
    console.error(e);
    throw new Error(`Could not update processor ${processorId} and processor ${processorId}`);
  }
};
