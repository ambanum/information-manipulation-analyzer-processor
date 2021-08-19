import { Document, Model, Schema, model } from 'mongoose';

export interface Processor extends Document {
  _id: string;
  lastPollAt?: string | Date;
  lastProcessedAt?: string | Date;
  metadata?: any;
}

const ProcessorSchema = new Schema<Processor>(
  {
    _id: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      description:
        'field used to store relevant informations on the processor, such as tools version',
    },
    lastPollAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastProcessedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    _id: false,
    strict: 'throw',
    timestamps: true,
  }
);

const ProcessorModel: Model<Processor> = model('Processor', ProcessorSchema);

export default ProcessorModel;
