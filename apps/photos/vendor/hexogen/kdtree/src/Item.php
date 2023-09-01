<?php


namespace Hexogen\KDTree;

use Hexogen\KDTree\Interfaces\ItemInterface;

class Item extends Point implements ItemInterface
{
    private $id;

    /**
     * Item constructor.
     * @param int $id
     * @param array $dValues
     */
    public function __construct(int $id, array $dValues)
    {
        parent::__construct($dValues);
        $this->id = $id;
    }

    /**
     * get item id
     *
     * @api
     * @return int item id
     */
    public function getId() : int
    {
        return $this->id;
    }
}
