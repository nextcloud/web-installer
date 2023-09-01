<?php

namespace Hexogen\KDTree\Interfaces;

interface ItemListInterface
{
    /**
     * Add item to the list
     * @api
     * @param ItemInterface $item
     */
    public function addItem(ItemInterface $item);

    /**
     * @return ItemInterface[] list of all items in the list
     */
    public function getItems(): array;

    /**
     * @return int number of dimensions in items(points)
     */
    public function getDimensionCount(): int;
}
