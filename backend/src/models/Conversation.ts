import mongoose, { Document, Schema } from 'mongoose';

export interface ITrace {
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
}

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  traces: ITrace[];
}

export interface IConversation extends Document {
  sessionId: string;
  messages: IMessage[];
}

const TraceSchema = new Schema<ITrace>({
  tool: { type: String, required: true },
  input: { type: Schema.Types.Mixed },
  output: { type: Schema.Types.Mixed },
  duration: { type: Number, default: 0 },
}, { _id: false });

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  traces: [TraceSchema],
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
  sessionId: { type: String, required: true, unique: true, index: true },
  messages: [MessageSchema],
}, { timestamps: true });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
