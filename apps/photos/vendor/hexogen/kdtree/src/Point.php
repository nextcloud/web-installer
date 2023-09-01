<?php

namespace Hexogen\KDTree;

use Hexogen\KDTree\Exception\ValidationException;
use Hexogen\KDTree\Interfaces\PointInterface;

class Point implements PointInterface
{
    private $dValues;
    private $length;

    /**
     * Item constructor.
     * @param array $dValues
     */
    public function __construct(array $dValues)
    {
        $this->length = count($dValues);
        $this->validateDValues($dValues);

        $this->dValues = $dValues;
    }

    /**
     * get nth dimension value from vector
     *
     * @api
     * @param int $d
     * @return float
     */
    public function getNthDimension(int $d): float
    {
        if ($d < 0 || $d >= $this->length) {
            throw new \OutOfRangeException('$d = ' . $d . '  should be between 0 and number of ' . $this->length);
        }
        return (float)$this->dValues[$d];
    }


    /**
     * validate multi dimension vector
     *
     * @param array $dValues
     * @throws ValidationException
     */
    private function validateDValues(array $dValues)
    {
        if ($this->length == 0) {
            throw new ValidationException('$dValues should be not empty');
        }

        for ($i = 0; $i < $this->length; $i++) {
            if (!isset($dValues[$i]) || !is_numeric($dValues[$i])) {
                throw new ValidationException('$dValues is not a simple array list');
            }
        }
    }

    /**
     * @api
     * @return int number of dimensions in the point
     */
    public function getDimensionsCount(): int
    {
        return $this->length;
    }
}
