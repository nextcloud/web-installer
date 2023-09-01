<?php

namespace Hexogen\KDTree\Interfaces;

abstract class SearchAbstract
{
    /**
     * @var KDTreeInterface
     */
    protected $tree;

    /**
     * @var int
     */
    protected $dimensions;

    /**
     * SearchAbstract constructor.
     * @param KDTreeInterface $tree
     */
    public function __construct(KDTreeInterface $tree)
    {
        $this->tree = $tree;
        $this->dimensions = $tree->getDimensionCount();
    }

    /**
     * Search items it the tree by given algorithm
     *
     * @api
     * @param PointInterface $point
     * @param int $resultLength
     * @return array
     */
    abstract public function search(PointInterface $point, int $resultLength = 1) : array;
}
