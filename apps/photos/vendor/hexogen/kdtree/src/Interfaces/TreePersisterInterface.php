<?php

namespace Hexogen\KDTree\Interfaces;

interface TreePersisterInterface
{
    /**
     * @api
     * @param KDTreeInterface $tree
     * @param string $identifier that identifies persisted tree(may be a filename, database name etc.)
     * @return mixed
     */
    public function convert(KDTreeInterface $tree, string $identifier);
}
