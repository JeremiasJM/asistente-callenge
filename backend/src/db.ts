import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/agente-ventas';
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB conectado en:', uri);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};
