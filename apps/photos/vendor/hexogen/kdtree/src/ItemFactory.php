<?php


namespace Hexogen\KDTree;

use Hexogen\KDTree\Interfaces\ItemFactoryInterface;
use Hexogen\KDTree\Interfaces\ItemInterface;

class ItemFactory implements ItemFactoryInterface
{
    /**
     * @api
     * @param int $id
     * @param array $dValues
     * @return ItemInterface
     */
    public function make(int $id, array $dValues) : ItemInterface
    {
        return new Item($id, $dValues);
    }
}
