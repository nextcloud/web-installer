<?php

namespace Hexogen\KDTree\Interfaces;

interface PointInterface
{
    /**
     * get nth dimension value from vector
     *
     * @api
     * @param int $d dimension of the point
     * @return float
     */
    public function getNthDimension(int $d): float;

    /**
     * @api
     * @return int number of dimensions in array
     */
    public function getDimensionsCount(): int;
}
