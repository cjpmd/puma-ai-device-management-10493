
import * as tf from '@tensorflow/tfjs';
import { supabase } from '@/integrations/supabase/client';
import { ModelVersion, WeightsManifestEntry } from './types';

/**
 * Save model weights as JSON
 */
export const saveModelParameters = async (model: tf.Sequential): Promise<any[]> => {
  // Extract model weights
  const weights = model.getWeights();
  const weightsData = weights.map(tensor => {
    const values = tensor.dataSync();
    const shape = tensor.shape;
    return {
      values: Array.from(values),
      shape
    };
  });
  
  return weightsData;
};

/**
 * Save a model version to Supabase
 */
export const saveModelVersion = async (
  model: tf.Sequential,
  version: string,
  accuracy: number
): Promise<string> => {
  try {
    // Save model parameters
    const parameters = await saveModelParameters(model);
    
    // Add model to the database
    const { data, error } = await supabase
      .from('ml_models')
      .insert({
        name: `Model ${version}`,
        version,
        accuracy,
        model_data: JSON.stringify(parameters)
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving model version:', error);
      throw error;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error saving model version:', error);
    throw error;
  }
};

/**
 * Load a model from Supabase by ID
 */
export const loadModelById = async (modelId: string): Promise<tf.Sequential> => {
  try {
    const { data, error } = await supabase
      .from('ml_models')
      .select()
      .eq('id', modelId)
      .single();
    
    if (error || !data) {
      console.error('Error loading model:', error);
      throw new Error('Model not found');
    }
    
    const parametersStr = typeof (data as any).model_data === 'string' 
      ? (data as any).model_data 
      : JSON.stringify((data as any).model_data);
    
    return loadModelFromParameters(parametersStr);
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
};

/**
 * Load a model from parameters
 */
export const loadModelFromParameters = async (parametersJson: string): Promise<tf.Sequential> => {
  try {
    const parameters = JSON.parse(parametersJson);
    
    // Create a new model with the same architecture
    const model = tf.sequential();
    
    // Add LSTM layer with input shape
    model.add(tf.layers.lstm({
      units: 64,
      inputShape: [null, 4],
      returnSequences: true
    }));
    
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    model.add(tf.layers.lstm({
      units: 32,
      returnSequences: false
    }));
    
    model.add(tf.layers.dense({
      units: 5,
      activation: 'softmax'
    }));
    
    // Compile the model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Set weights from parameters
    const weights = parameters.map((param: any) => {
      return tf.tensor(param.values, param.shape);
    });
    
    model.setWeights(weights);
    
    return model;
  } catch (error) {
    console.error('Error loading model from parameters:', error);
    throw error;
  }
};

/**
 * Get all model versions from Supabase
 */
export const getAllModelVersions = async (): Promise<ModelVersion[]> => {
  try {
    const { data, error } = await supabase
      .from('ml_models')
      .select()
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching model versions:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    return data.map((item: any) => ({
      id: item.id,
      version: item.version,
      accuracy: item.accuracy,
      parameters: typeof item.model_data === 'string' ? item.model_data : JSON.stringify(item.model_data),
      created_at: item.created_at,
      updated_at: item.updated_at,
      training_date: item.created_at,
      model_file_path: undefined,
    }));
  } catch (error) {
    console.error('Error fetching model versions:', error);
    return [];
  }
};

/**
 * Get the best model by accuracy
 */
export const getBestModel = async (): Promise<{ model: tf.Sequential; version: ModelVersion } | null> => {
  try {
    const versions = await getAllModelVersions();
    
    if (versions.length === 0) {
      return null;
    }
    
    // Find the version with the highest accuracy
    const bestVersion = versions.reduce((best, current) => {
      return current.accuracy > best.accuracy ? current : best;
    }, versions[0]);
    
    const model = await loadModelFromParameters(bestVersion.parameters);
    
    return { model, version: bestVersion };
  } catch (error) {
    console.error('Error getting best model:', error);
    return null;
  }
};
