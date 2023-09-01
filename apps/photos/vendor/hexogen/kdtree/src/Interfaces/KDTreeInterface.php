<?php

namespace Hexogen\KDTree\Interfaces;

interface KDTreeInterface
{
    /**
     * @return int number of items in the set
     */
    public function getItemCount() : int;

    /**
     * @return int number of point dimensions
     */
    public function getDimensionCount() : int;

    /**
     * @return NodeInterface|null root node of the tree
     */
    public function getRoot() : ?NodeInterface;

    /**
     * @return array lower corner coordinate of the virtual multidimensional
     * orthogon that fits all points of the kd tree
     */
    public function getMinBoundary() : array;

    /**
     * @return array upper corner coordinate of the virtual multidimensional
     * orthogon that fits all points of the kd tree
     */
    public function getMaxBoundary() : array;
}
