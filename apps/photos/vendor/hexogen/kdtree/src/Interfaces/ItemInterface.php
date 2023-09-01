<?php

namespace Hexogen\KDTree\Interfaces;

interface ItemInterface extends PointInterface
{
    /**
     * get item id
     *
     * @api
     * @return int item id
     */
    public function getId() : int;
}
