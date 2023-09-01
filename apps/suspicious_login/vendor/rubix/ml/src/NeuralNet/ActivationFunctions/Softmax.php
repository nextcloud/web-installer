<?php

namespace Rubix\ML\NeuralNet\ActivationFunctions;

use Tensor\Matrix;

use const Rubix\ML\EPSILON;

/**
 * Softmax
 *
 * The Softmax function is a generalization of the Sigmoid function that squashes
 * each activation between 0 and 1, and all activations add up to 1.
 *
 * @category    Machine Learning
 * @package     Rubix/ML
 * @author      Andrew DalPino
 */
class Softmax extends Sigmoid
{
    /**
     * Compute the output value.
     *
     * @internal
     *
     * @param \Tensor\Matrix $z
     * @return \Tensor\Matrix
     */
    public function compute(Matrix $z) : Matrix
    {
        $zHat = $z->exp()->transpose();

        $total = $zHat->sum()->clipLower(EPSILON);

        return $zHat->divide($total)->transpose();
    }

    /**
     * Return the string representation of the object.
     *
     * @return string
     */
    public function __toString() : string
    {
        return 'Softmax';
    }
}
