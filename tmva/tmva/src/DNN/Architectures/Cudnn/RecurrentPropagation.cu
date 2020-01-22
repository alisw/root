// @(#)root/tmva/tmva/dnn:$Id$
// Author: Lorenzo Moneta 2020

/*************************************************************************
 * Copyright (C) 2017, Saurav Shekhar                                    *
 * All rights reserved.                                                  *
 *                                                                       *
 * For the licensing terms see $ROOTSYS/LICENSE.                         *
 * For the list of contributors see $ROOTSYS/README/CREDITS.             *
 *************************************************************************/

 //////////////////////////////////////////////////////////////////
 // Implementation of the functions required for the forward and //
 // backward propagation of activations through a recurrent  neural network //
 // for CUDA architectures.                                      //
 //////////////////////////////////////////////////////////////////

#include "TMVA/DNN/Architectures/TCudnn.h"

namespace TMVA
{
namespace DNN
{
template <typename AFloat>
void TCudnn<AFloat>::InitializeRNNTensors(RNNLayer_t *layer)
{
   // initialization of the RNN tensors for setting the right layout (ROW major)
   size_t timeSteps = (layer->IsReturnSequence()) ? layer->GetTimeSteps() : 1;
   layer->GetOutput() =
      Tensor_t(layer->GetOutput().GetDeviceBuffer(),
               {layer->GetBatchSize(), timeSteps, layer->GetStateSize()}, GetTensorLayout());
   layer->GetActivationGradients() =
      Tensor_t(layer->GetActivationGradients().GetDeviceBuffer(), {layer->GetBatchSize(), timeSteps, layer->GetStateSize()},
               GetTensorLayout());

   // make the weight tensors in the right layout (Row-major)
   layer->GetWeightsState() = Tensor_t(layer->GetWeightsState().GetDeviceBuffer(),
                                      {layer->GetStateSize(), layer->GetStateSize()}, GetTensorLayout());
   layer->GetWeightsInput() = Tensor_t(layer->GetWeightsInput().GetDeviceBuffer(),
                                      {layer->GetStateSize(), layer->GetInputSize()}, GetTensorLayout());
   layer->GetBiasesState() = Tensor_t(layer->GetBiasesState().GetDeviceBuffer(),
                                       {layer->GetStateSize(),   1 }, GetTensorLayout());

   layer->GetX() = Tensor_t({layer->GetTimeSteps(), layer->GetBatchSize(), layer->GetInputSize() }, GetTensorLayout());
   layer->GetY() = Tensor_t({layer->GetTimeSteps(), layer->GetBatchSize(), layer->GetStateSize() }, GetTensorLayout());

   layer->GetDX() = Tensor_t({layer->GetTimeSteps(), layer->GetBatchSize(), layer->GetInputSize() }, GetTensorLayout());
   layer->GetDY() = Tensor_t({layer->GetTimeSteps(), layer->GetBatchSize(), layer->GetStateSize() }, GetTensorLayout());
}
//____________________________________________________________________________
template <typename AFloat>
void TCudnn<AFloat>::InitializeRNNDescriptors(TDescriptors * & descriptors, RNNLayer_t *layer)
{

   auto rnnDescriptors = new RNNDescriptors_t ();
   CUDNNCHECK(cudnnCreateRNNDescriptor(&rnnDescriptors->LayerDescriptor));

   CUDNNCHECK(cudnnCreateDropoutDescriptor(&rnnDescriptors->HelperDescriptor));

   cudnnHandle_t  handle = layer->GetOutput().GetCudnnHandle();
   float dropoutProb = 0.0; // layer->GetDroputProbability();

   void *dropoutStates = nullptr; // random generator states ??
   size_t dropoutStateSize = 0;

   // get size of droput states
   CUDNNCHECK(cudnnDropoutGetStatesSize(handle, &dropoutStateSize));

   //unsigned long long seed = GetRandomGenerator().Integer(INT_MAX);
   // use GetSeed to avoid generating other numbers which will break sequence
   unsigned long long seed = GetRandomGenerator().GetSeed();

   CUDNNCHECK(cudnnSetDropoutDescriptor(rnnDescriptors->HelperDescriptor, handle, dropoutProb, dropoutStates,
                                        dropoutStateSize, seed));
   // cudnnDropoutDescriptor_t    dropoutDesc,
   // cudnnHandle_t               handle,
   // float                       dropout,
   // void                       *states,
   // size_t                      stateSizeInBytes,
   // unsigned long long          seed)

   int hiddenSize = layer->GetStateSize();
   int numLayers = 1;  // this is not time steps is for stacked layers // layer->GetTimeSteps();
   //cudnnRNNInputMode_t    inputMode = CUDNN_SKIP_INPUT; // the leasing dimension of x must be equal to hiddenSize
   cudnnRNNInputMode_t    inputMode = CUDNN_LINEAR_INPUT;  // this a vanilla rnn

   cudnnDirectionMode_t   direction = CUDNN_UNIDIRECTIONAL;  // can be CUDNN_BIDIRECTIONAL
   bool bidirectional = (direction == CUDNN_BIDIRECTIONAL);

   cudnnRNNMode_t mode = CUDNN_RNN_TANH;             // can be CUDNN_RNN_RELU, CUDNN_LSTM, CUDNN_GRU
   cudnnRNNAlgo_t   algo = CUDNN_RNN_ALGO_STANDARD;  // can be also CUDNN_RNN_ALGO_PERSIST_STATIC or CUDNN_RNN_ALGO_PERSIST_DYNAMIC

   int numLinearLayers = 0;
   if (mode == CUDNN_RNN_RELU || mode == CUDNN_RNN_TANH) {
      numLinearLayers = 2;
   }

   cudnnDataType_t mathPrec = CUDNN_DATA_FLOAT;
   if      (std::is_same<AFloat, double>::value) { mathPrec = CUDNN_DATA_DOUBLE;}

   CUDNNCHECK(cudnnSetRNNDescriptor(handle, rnnDescriptors->LayerDescriptor, hiddenSize, numLayers, rnnDescriptors->HelperDescriptor,
      inputMode, direction, mode, algo, mathPrec) );


   // set bias mode
   cudnnRNNBiasMode_t biasMode = CUDNN_RNN_NO_BIAS;
   if (layer->GetBiases().size() == 1)
      biasMode = CUDNN_RNN_SINGLE_REC_BIAS;
      //biasMode = CUDNN_RNN_DOUBLE_BIAS;

   CUDNNCHECK(cudnnSetRNNBiasMode(rnnDescriptors->LayerDescriptor, biasMode));

   // define tensor descriptors for RNN

   int dimA[3];
   int strideA[3];
   int seqLength = layer->GetTimeSteps();

   rnnDescriptors->xDesc.resize(seqLength);
   rnnDescriptors->yDesc.resize(seqLength);
   rnnDescriptors->dxDesc.resize(seqLength);
   rnnDescriptors->dyDesc.resize(seqLength);
   TensorDescriptor_t *xDesc = rnnDescriptors->xDesc.data();
   TensorDescriptor_t *yDesc = rnnDescriptors->yDesc.data();
   TensorDescriptor_t *dxDesc = rnnDescriptors->dxDesc.data();
   TensorDescriptor_t *dyDesc = rnnDescriptors->dyDesc.data();

   for (int i = 0; i < seqLength; i++) {
      CUDNNCHECK(cudnnCreateTensorDescriptor(&xDesc[i]));
      CUDNNCHECK(cudnnCreateTensorDescriptor(&yDesc[i]));
      CUDNNCHECK(cudnnCreateTensorDescriptor(&dxDesc[i]));
      CUDNNCHECK(cudnnCreateTensorDescriptor(&dyDesc[i]));

      dimA[0] = layer->GetBatchSize();
      dimA[1] = layer->GetInputSize();
      dimA[2] = 1;

      strideA[0] = dimA[2] * dimA[1];
      strideA[1] = dimA[2];
      strideA[2] = 1;

      CUDNNCHECK(cudnnSetTensorNdDescriptor(xDesc[i], mathPrec, 3, dimA, strideA));
      CUDNNCHECK(cudnnSetTensorNdDescriptor(dxDesc[i], mathPrec, 3, dimA, strideA));

      dimA[0] = layer->GetBatchSize();
      dimA[1] = bidirectional ? hiddenSize * 2 : hiddenSize;
      dimA[2] = 1;

      strideA[0] = dimA[2] * dimA[1];
      strideA[1] = dimA[2];
      strideA[2] = 1;

      CUDNNCHECK(cudnnSetTensorNdDescriptor(yDesc[i], mathPrec, 3, dimA, strideA));
      CUDNNCHECK(cudnnSetTensorNdDescriptor(dyDesc[i], mathPrec, 3, dimA, strideA));
   }

   // weight descriptor
   CUDNNCHECK(cudnnCreateFilterDescriptor(&rnnDescriptors->WeightsDescriptor));
   CUDNNCHECK(cudnnCreateFilterDescriptor(&rnnDescriptors->WeightsGradDescriptor));

   // Set the  filter parameters
   size_t weightsSize = 0;
   CUDNNCHECK(cudnnGetRNNParamsSize(handle, rnnDescriptors->LayerDescriptor, xDesc[0], &weightsSize, mathPrec));

   int dimW[3];
   dimW[0] = (mathPrec == CUDNN_DATA_DOUBLE) ? weightsSize / sizeof(double) : weightsSize / sizeof(float);
   dimW[1] = 1;
   dimW[2] = 1;

   CUDNNCHECK(cudnnSetFilterNdDescriptor(rnnDescriptors->WeightsDescriptor, mathPrec, CUDNN_TENSOR_NCHW, 3, dimW));
   CUDNNCHECK(cudnnSetFilterNdDescriptor(rnnDescriptors->WeightsGradDescriptor, mathPrec, CUDNN_TENSOR_NCHW, 3, dimW));

   // resize now weights tensor
   auto &weightTensor = layer->GetWeightsTensor();
   auto &weightGradTensor = layer->GetWeightGradientsTensor();

   size_t nW = dimW[0];
   weightTensor = Tensor_t( {nW, 1, 1}, GetTensorLayout(), 0, 0);
   weightGradTensor = Tensor_t({ nW, 1, 1}, GetTensorLayout(), 0, 0);

   // initialize now RNN weights from RNNLayer:WeightInput, RNNLayer::WeightState and RNNLayer::BiasesState

    // support now only one single layer and not bidirectional
   int nL = (!bidirectional) ? numLayers : 2 * numLayers; // for bidirectional nL = 2 * numLayers;
   for (int ilayer = 0; ilayer < nL; ilayer++) {
      for (int linLayerID = 0; linLayerID < numLinearLayers; linLayerID++) {
         cudnnFilterDescriptor_t linLayerMatDesc;
         CUDNNCHECK(cudnnCreateFilterDescriptor(&linLayerMatDesc));
         AFloat *linLayerMat;

         CUDNNCHECK(cudnnGetRNNLinLayerMatrixParams(handle, rnnDescriptors->LayerDescriptor, ilayer, rnnDescriptors->xDesc.data()[0],
                                                    rnnDescriptors->WeightsDescriptor, weightTensor.GetDataPointer(),
                                                    linLayerID, linLayerMatDesc, (void **)&linLayerMat));

         cudnnDataType_t dataType;
         cudnnTensorFormat_t format;
         int nbDims;
         int filterDimA[3];
         CUDNNCHECK(cudnnGetFilterNdDescriptor(linLayerMatDesc, 3, &dataType, &format, &nbDims, filterDimA));

         // initGPUData(linLayerMat, filterDimA[0] * filterDimA[1] * filterDimA[2],
         //             1.f / (float)(filterDimA[0] * filterDimA[1] * filterDimA[2]));

         // copy layer weights in linLayerMat
         if (linLayerID == 0)
         {
            // copy from GetStateWeights (tensor is state x state)
            int wsize = layer->GetWeightsInput().GetSize();

            // std::cout << "input weight size = " << wsize << "  { " << layer->GetWeightsInput().GetNrows() << "  "
            //           << layer->GetWeightsInput().GetNcols() << "} should be " << filterDimA[1] << " x "
            //           << filterDimA[2] << std::endl;

            //PrintTensor(layer->GetWeightsInput(), "Weight input");

            assert(wsize == filterDimA[1] * filterDimA[2]);
            cudaMemcpyAsync(linLayerMat, layer->GetWeightsInput().GetDataPointer(), wsize * sizeof(AFloat),
                            cudaMemcpyDeviceToDevice, layer->GetWeightsInput().GetComputeStream());

            //PrintTensor(weightTensor, "After inputW WeightTensor");
         }
         if (linLayerID == 1) {
            // copy from GetStateWeights (tensor is state x state)
            int wsize = layer->GetWeightsState().GetSize();

            // std::cout << "state weight size = " << wsize << "  { " << layer->GetWeightsState().GetNrows() << " , "
            //           << layer->GetWeightsState().GetNcols() << "}  should be " << filterDimA[1] << " x " << filterDimA[2]
            //           << std::endl;

            //PrintTensor(layer->GetWeightsState(), "Weight state");

            assert(wsize == filterDimA[1] * filterDimA[2]);
            cudaMemcpyAsync(linLayerMat, layer->GetWeightsState().GetDataPointer(), wsize * sizeof(AFloat),
                            cudaMemcpyDeviceToDevice, layer->GetWeightsState().GetComputeStream());

            //PrintTensor(weightTensor, "After stateW WeightTensor");
         }

         CUDNNCHECK(cudnnDestroyFilterDescriptor(linLayerMatDesc));

         cudnnFilterDescriptor_t linLayerBiasDesc;
         CUDNNCHECK(cudnnCreateFilterDescriptor(&linLayerBiasDesc));
         AFloat *linLayerBias;

         CUDNNCHECK(cudnnGetRNNLinLayerBiasParams(handle, rnnDescriptors->LayerDescriptor, ilayer,
                                                  rnnDescriptors->xDesc.data()[0], rnnDescriptors->WeightsDescriptor,
                                                  weightTensor.GetDataPointer(), linLayerID, linLayerBiasDesc,
                                                  (void **)&linLayerBias));

         CUDNNCHECK(cudnnGetFilterNdDescriptor(linLayerBiasDesc, 3, &dataType, &format, &nbDims, filterDimA));

         if (filterDimA[0] > 0 && linLayerID == 0 || linLayerID == 1) { // not sure if 0 or 1
            // copy from GetStateWeights (tensor is state x state)
            int wsize = layer->GetBiasesState().GetSize();

            // std::cout << "state bias " << wsize << "  { " << layer->GetBiasesState().GetNrows() << "  "
            //           << layer->GetBiasesState().GetNcols() << "}  should be " << filterDimA[1] << " x " << filterDimA[2]
            //           << std::endl;

            //PrintTensor(layer->GetBiasesState(), "Bias state");

            assert(wsize == filterDimA[1]);
            cudaMemcpyAsync(linLayerBias, layer->GetBiasesState().GetDataPointer(), wsize * sizeof(AFloat),
                            cudaMemcpyDeviceToDevice, layer->GetBiasesState().GetComputeStream());

            //PrintTensor(weightTensor, "After biasW WeightTensor");
         }
         // else if (linLayerID == 1) {
         //    // copy from GetStateWeights (tensor is state x state)
         //    int wsize = layer->GetWeightsInput().GetNoOfElements();

         //    std::cout << "input weight " << wsize << "  { " << layer->GetWeightsInput().GetNrows() << "  "
         //              << layer->GetWeightsState().GetNcols() << " should be " << filterDimA[1] << "  " <<
         //              filterDimA[2]
         //              << std::endl;

         //    cudaMemcpyAsync(linLayerMat, layer->GetWeightsInput().GetDataPointer(), wsize * sizeof(AFloat),
         //                    cudaMemcpyDeviceToDevice, layer->GetWeightsInput().GetComputeStream());
         // }

         CUDNNCHECK(cudnnGetFilterNdDescriptor(linLayerBiasDesc, 3, &dataType, &format, &nbDims, filterDimA));

         // initGPUData(linLayerBias, filterDimA[0] * filterDimA[1] * filterDimA[2], 1.f);

         CUDNNCHECK(cudnnDestroyFilterDescriptor(linLayerBiasDesc));
      }

   }

   //PrintTensor(weightTensor, "Full WeightTensor");

   // the weight tensor in Cudnn is stored as
   // weights input + weights state + bias state
   auto &weightsInput = layer->GetWeightsInput();
   auto &weightsState = layer->GetWeightsState();
   auto &biasesState  = layer->GetBiasesState();

   auto &weightInputGrad = layer->GetWeightInputGradients();
   auto &weightStateGrad = layer->GetWeightStateGradients();
   auto &biasStateGrad = layer->GetBiasStateGradients();

   size_t offset_state = weightsInput.GetSize();
   size_t offset_bias_state = offset_state + weightsState.GetSize();

   assert(weightTensor(0,0,0) == weightsInput(0,0));
   assert(weightTensor(offset_state,0,0) == weightsState(0,0));
   assert(weightTensor(offset_bias_state,0,0) == biasesState(0,0));

   // now we set the right buffers for the tensor weights and gradients
   weightsInput = Tensor_t(weightTensor.GetDeviceBuffer().GetSubBuffer(0, weightsInput.GetSize()),
                           weightsInput.GetShape(), GetTensorLayout(), 0, 0);
   weightsState = Tensor_t(weightTensor.GetDeviceBuffer().GetSubBuffer(offset_state, weightsState.GetSize()),
                           weightsState.GetShape(), GetTensorLayout(), 0, 0);
   biasesState = Tensor_t(weightTensor.GetDeviceBuffer().GetSubBuffer(offset_bias_state, biasesState.GetSize()),
                          biasesState.GetShape(), GetTensorLayout(), 0, 0);

   weightInputGrad = Tensor_t(weightGradTensor.GetDeviceBuffer().GetSubBuffer(0, weightInputGrad.GetSize()),
                               weightInputGrad.GetShape(), GetTensorLayout(), 0, 0);
   weightStateGrad =
      Tensor_t(weightGradTensor.GetDeviceBuffer().GetSubBuffer(offset_state, weightStateGrad.GetSize()),
               weightStateGrad.GetShape(), GetTensorLayout(), 0, 0);
   biasStateGrad =
      Tensor_t(weightGradTensor.GetDeviceBuffer().GetSubBuffer(offset_bias_state, biasStateGrad.GetSize()),
               biasStateGrad.GetShape(), GetTensorLayout(), 0, 0);

   // auto &weightVector = layer->GetWeights();
   // weightVector.resize(1);
   // weightVector[0] = weightTensor;
   // auto &weightGradVector = layer->GetWeightGradients();
   // weightGradVector.resize(1);
   // weightGradVector[0] = weightGradTensor;


   descriptors = rnnDescriptors;
}

//____________________________________________________________________________
template<typename AFloat>
void TCudnn<AFloat>::ReleaseRNNDescriptors(TDescriptors * descriptors)
{
   auto rnnDescriptors = static_cast<RNNDescriptors_t *>(descriptors);
   CUDNNCHECK(cudnnDestroyRNNDescriptor(rnnDescriptors->LayerDescriptor));

   ReleaseDescriptor(rnnDescriptors->HelperDescriptor);
   ReleaseDescriptor(rnnDescriptors->WeightsDescriptor);
   ReleaseDescriptor(rnnDescriptors->WeightsGradDescriptor);

   // need to delete the vectors of tensor descriptors
   for (size_t i = 0; i < rnnDescriptors->xDesc.size(); i++) {
      cudnnDestroyTensorDescriptor(rnnDescriptors->xDesc.data()[i]);
      cudnnDestroyTensorDescriptor(rnnDescriptors->yDesc.data()[i]);

      cudnnDestroyTensorDescriptor(rnnDescriptors->dxDesc.data()[i]);
      cudnnDestroyTensorDescriptor(rnnDescriptors->dyDesc.data()[i]);
   }

}


//____________________________________________________________________________
template <typename AFloat>
void TCudnn<AFloat>::InitializeRNNWorkspace(TWorkspace * & workspace,
                                             TDescriptors * & descriptors,
                                             RNNLayer_t *layer)
{
   auto rnnWorkspace = new RNNWorkspace_t ();
   auto rnnDescriptors = static_cast<RNNDescriptors_t *>(descriptors);

   cudnnHandle_t handle = layer->GetOutput().GetCudnnHandle();

   bool bidirectional = false;

   int numLayers = 1; // support now only one single layer
   size_t nL = (!bidirectional) ? numLayers : 2*numLayers; // for bidirectional nL = 2 * numLayers;

   // reshape tensors ??
   // redefine shape of layer->GetShape
   Tensor_t &stateTensor = layer->GetState();
   stateTensor = Tensor_t(stateTensor.GetDeviceBuffer(), { nL, layer->GetBatchSize(), layer->GetStateSize()},
                          GetTensorLayout(), 0, 0 );

   Tensor_t &cellStateTensor = layer->GetCellState();
   cellStateTensor = Tensor_t(cellStateTensor.GetDeviceBuffer(), {nL, layer->GetBatchSize(), layer->GetStateSize()}, GetTensorLayout(), 0, 0 );

   //int numLinearLayers = 2; // for RNN_RELU and RNN_TANH
   //  this could be set eq to layer.GetWeights().size()

   // cudnnDataType_t mathPrec;
   // if (std::is_same<AFloat, double>::value) {
   //    mathPrec = CUDNN_DATA_DOUBLE;
   // } else if (std::is_same<AFloat, float>::value) {
   //    mathPrec = CUDNN_DATA_FLOAT;
   // }


   // get workspace size
   //size_t sizeInBytes = 0;

   // need to fill xDesc with input tensor descriptors for each layer
   CUDNNCHECK(cudnnGetRNNWorkspaceSize(handle, rnnDescriptors->LayerDescriptor, layer->GetTimeSteps(),
                                       rnnDescriptors->xDesc.data(), &rnnWorkspace->ForwardWorkspaceSize));

   if (rnnWorkspace->ForwardWorkspaceSize) cudaMalloc(&rnnWorkspace->ForwardWorkspace, rnnWorkspace->ForwardWorkspaceSize*sizeof(AFloat));
   if (rnnWorkspace->ForwardWorkspaceSize > 0 && rnnWorkspace->ForwardWorkspace == nullptr  ) {
      std::cerr << "Error allocating RNN workspace of size " << rnnWorkspace->ForwardWorkspaceSize << " - probably running out of memory on the GPU"
               << std::endl;
      std::cout << " layer input shape is  { " << layer->GetBatchSize() << " , " <<  layer->GetTimeSteps() << " , "
                                                            <<layer->GetStateSize() << " } " << std::endl;

      R__ASSERT(false);
   }

   CUDNNCHECK(cudnnGetRNNTrainingReserveSize(handle, rnnDescriptors->LayerDescriptor, layer->GetTimeSteps(),
                                             rnnDescriptors->xDesc.data(), &rnnWorkspace->HelperWorkspaceSize));

   if (rnnWorkspace->HelperWorkspaceSize) cudaMalloc(&rnnWorkspace->HelperWorkspace, rnnWorkspace->HelperWorkspaceSize*sizeof(AFloat));
   if (rnnWorkspace->HelperWorkspaceSize > 0 && rnnWorkspace->HelperWorkspace == nullptr  ) {
      std::cerr << "Error allocating RNN reserved workspace of size " << rnnWorkspace->HelperWorkspaceSize << " - probably running out of memory on the GPU"
               << std::endl;
      std::cout << " layer input shape is  { " << layer->GetBatchSize() << " , " <<  layer->GetTimeSteps() << " , "
                                                            <<layer->GetStateSize() << " } " << std::endl;

      R__ASSERT(false);
   }
   workspace = rnnWorkspace;
}

//____________________________________________________________________________
template <typename AFloat>
void TCudnn<AFloat>::FreeRNNWorkspace(TWorkspace * workspace) {
   if (!workspace) return;
   auto rnnWorkspace = static_cast<RNNWorkspace_t *>(workspace);

   if(rnnWorkspace->ForwardWorkspace)  cudaFree(rnnWorkspace->ForwardWorkspace);
   if(rnnWorkspace->HelperWorkspace)   cudaFree(rnnWorkspace->HelperWorkspace);


}

//____________________________________________________________________________
template <typename AFloat>
void TCudnn<AFloat>::RNNForward(const Tensor_t &x, const Tensor_t &hx, const Tensor_t &cx, const Tensor_t & weights, Tensor_t &y,
                                         Tensor_t &hy, Tensor_t &cy, const RNNDescriptors_t & desc, RNNWorkspace_t &workspace, bool isTraining )

{

   cudnnHandle_t cudnnHandle = x.GetCudnnHandle();

   int seqLength = x.GetShape()[0];  // time steps
   cudnnRNNDescriptor_t rnnDesc = desc.LayerDescriptor;

   // initial state and cell state will be set to zero
   //isTraining = true;
   // Perform forward training
   if (isTraining) {
      cudnnStatus_t status = cudnnRNNForwardTraining(
         cudnnHandle, rnnDesc, seqLength, desc.xDesc.data(), x.GetDataPointer(), hx.GetTensorDescriptor(), nullptr
         /* hx.GetDataPointer() */, cx.GetTensorDescriptor(), nullptr /* cx.GetDataPointer() */, desc.WeightsDescriptor,
         weights.GetDataPointer(), desc.yDesc.data(), y.GetDataPointer(), hy.GetTensorDescriptor(), hy.GetDataPointer(),
         cy.GetTensorDescriptor(), cy.GetDataPointer(), workspace.ForwardWorkspace, workspace.ForwardWorkspaceSize,
         workspace.HelperWorkspace, workspace.HelperWorkspaceSize);

      assert(status == CUDNN_STATUS_SUCCESS);
      CUDNNCHECK(status);

   }
   else {
      // perform inference
      cudnnStatus_t status = cudnnRNNForwardInference(
         cudnnHandle, rnnDesc, seqLength, desc.xDesc.data(), x.GetDataPointer(), hx.GetTensorDescriptor(), nullptr
         /* hx.GetDataPointer() */, cx.GetTensorDescriptor(), nullptr /* cx.GetDataPointer() */, desc.WeightsDescriptor,
         weights.GetDataPointer(), desc.yDesc.data(), y.GetDataPointer(), hy.GetTensorDescriptor(), hy.GetDataPointer(),
         cy.GetTensorDescriptor(), cy.GetDataPointer(), workspace.ForwardWorkspace, workspace.ForwardWorkspaceSize);

      assert(status == CUDNN_STATUS_SUCCESS);
      CUDNNCHECK(status);
   }
}

//____________________________________________________________________________
template <typename AFloat>
void TCudnn<AFloat>::RNNBackward(const Tensor_t &x, const Tensor_t &hx, const Tensor_t &cx, const Tensor_t &y,
                                 const Tensor_t &dy, const Tensor_t &dhy, const Tensor_t &dcy, const Tensor_t &weights,
                                 Tensor_t &dx, Tensor_t &dhx, Tensor_t &dcx, Tensor_t &dw, const RNNDescriptors_t &desc,
                                 RNNWorkspace_t &workspace)

{
   int seqLength = x.GetShape()[0];
   cudnnRNNDescriptor_t rnnDesc = desc.LayerDescriptor;
   cudnnHandle_t cudnnHandle = x.GetCudnnHandle();

   // first data gradients (if dx is a summy tensor is first layer and we skip the data gradients )
   //if (dx.GetSize() > 0) {
      // cudnn neeeds to call backwared data to make it work !!!
   //cudnnStatus_t status;
   cudnnStatus_t status = cudnnRNNBackwardData(
      cudnnHandle, rnnDesc, seqLength, desc.yDesc.data(), y.GetDataPointer(), desc.dyDesc.data(), dy.GetDataPointer(),
      dhy.GetTensorDescriptor(), nullptr /* dhy.GetDataPointer() */, dcy.GetTensorDescriptor(),
      nullptr /* dcy.GetDataPointer() */, desc.WeightsDescriptor, weights.GetDataPointer(), hx.GetTensorDescriptor(),
      nullptr /* hx.GetDataPointer() */, cx.GetTensorDescriptor(), nullptr /* cx.GetDataPointer() */,
      desc.dxDesc.data(), dx.GetDataPointer(), dhx.GetTensorDescriptor(), nullptr /* dhx.GetDataPointer() */,
      dcx.GetTensorDescriptor(), nullptr /* dcx.GetDataPointer() */, workspace.ForwardWorkspace,
      workspace.ForwardWorkspaceSize, workspace.HelperWorkspace, workspace.HelperWorkspaceSize);

   assert(status == CUDNN_STATUS_SUCCESS);
   CUDNNCHECK(status);

   // now the weights
   //PrintTensor(dw, "weight grad before");

   status = cudnnRNNBackwardWeights(cudnnHandle, rnnDesc, seqLength, desc.xDesc.data(), x.GetDataPointer(),
                                    hx.GetTensorDescriptor(), nullptr /* hx.GetDataPointer() */, desc.yDesc.data(),
                                    y.GetDataPointer(), workspace.ForwardWorkspace, workspace.ForwardWorkspaceSize,
                                    desc.WeightsGradDescriptor, dw.GetDataPointer(), workspace.HelperWorkspace,
                                    workspace.HelperWorkspaceSize);

   assert(status == CUDNN_STATUS_SUCCESS);
   CUDNNCHECK(status);

   //PrintTensor(dw, "weight grad after");
}


template<typename AFloat>
void  TCudnn<AFloat>::Rearrange(Tensor_t & y, const Tensor_t & x) {

   AFloat alpha = 1;
   AFloat beta = 0;
   cudnnHandle_t cudnnHandle = x.GetCudnnHandle();
   // x can be a tensor of dimension 3 or dimension 4
   Tensor_t tmp = x;
   TensorDescriptor_t d = tmp.GetTensorDescriptor();
   int n = 0;
   int dims[4];
   int strides[4];
   cudnnDataType_t dataType;
   cudnnGetTensorNdDescriptor(d,tmp.GetNDim() , &dataType, &n, dims, strides);
   assert(n >=3);

   // assume  x shape is B x T x S or B x T x 1 x S and y shape is T x B x S
   const int xNdim = 3;
   auto  outputShape = y.GetShape();
   assert(xNdim == y.GetNDim());
   // swap from x to y first 2 dimension
   assert(outputShape[0] = dims[1]);   // T
   assert(outputShape[1] == dims[0]);  // B
   assert(outputShape[2] == (n ==4) ? dims[3] : dims[2]); // S
   if (n==4) assert(dims[2] == 1);


   // input stride of T is S and of B is TxS
   int xStrides[xNdim] = { (int) outputShape[2], (int)(outputShape[2] * outputShape[0]), 1 };
   int xDims[xNdim];
   for (int i = 0; i < xNdim; ++i)
      xDims[i] = outputShape[i];

   cudnnStatus_t status = cudnnSetTensorNdDescriptor(d, dataType, xNdim, xDims, xStrides);
   assert(status == CUDNN_STATUS_SUCCESS);
   CUDNNCHECK(status);
   status = cudnnTransformTensor(cudnnHandle, &alpha, d, x.GetDataPointer() , &beta,
                                               y.GetTensorDescriptor(), y.GetDataPointer());
   assert(status == CUDNN_STATUS_SUCCESS);
   CUDNNCHECK(status);

   // reset original descriptor in tensor x
   status = cudnnSetTensorNdDescriptor(d, dataType, n, dims, strides);
   assert(status == CUDNN_STATUS_SUCCESS);

   //PrintTensor(x, "x as B x T x S");
   //PrintTensor(y, "y as T x B x S");
}

} // namespace DNN
} // namespace TMVA
