import * as mongoose from 'mongoose';
import { QueueItemActionTypes, QueueItemStatuses } from '../interfaces';
import './Hashtag';

const { Schema } = mongoose;

const schema = new Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      enum: Object.values(QueueItemActionTypes),
    },
    priority: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
      enum: Object.values(QueueItemStatuses),
    },
    processorId: {
      type: String,
      index: true,
      description:
        'The name of the processor it has been processed by initially. This is useful if the procesor fails and needs to start again',
    },
    metadata: {
      type: Schema.Types.Mixed,
      description:
        'field used to pass some filters or additional data to process data more finely (startDate, endDate, etc...)',
    },
    hashtag: { type: Schema.Types.ObjectId, ref: 'Hashtag' },
  },
  {
    strict: 'throw',
    timestamps: true,
  }
);

export default mongoose?.models?.QueueItem || mongoose.model('QueueItem', schema);
