<?php


namespace Hexogen\KDTree\Interfaces;

interface ItemFactoryInterface
{
    /**
     * Create an instance of ItemInterface
     * @api
     * @param int $id
     * @param array $dValues
     * @return ItemInterface
     */
    public function make(int $id, array $dValues) : ItemInterface;
}
