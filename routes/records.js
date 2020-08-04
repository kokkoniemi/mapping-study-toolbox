const db = require("../models");

const listing = (req, res) => {
    let { offset, limit, status } = req.query;
    offset = !offset ? 0 : parseInt(offset);
    limit = !limit ? 25 : parseInt(limit);
    const where = {};
    if (status !== undefined) {
        where.status = status === "null" ? null : status;
    }
    return db.Record.count({ where }).then(count => {
        db.Record.findAll({
            offset,
            limit,
            where,
            include: ['Publication', 'MappingOptions']
        }).then((records) => res.send({ count, records }))
    })
        .catch((err) => res.send(err));
};


const get = (req, res) => {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: ['Publication', 'MappingOptions'] })
        .then((record) => res.send(record))
        .catch((err) => res.send(err));
};

// only enable updating the status or comment of the record
const update = (req, res) => {
    const id = parseInt(req.params.id);
    return db.Record.findByPk(id, { include: ['Publication', 'MappingOptions'] })
        .then((record) => {
            const { status, editedBy, comment, MappingOptions } = req.body;
            if (status && ![null, "uncertain", "excluded", "included"].includes(status)) {
                throw new Error("Illegal value for 'status'");
            }
            return record.update({
                ...(status !== undefined ? { status } : {}),
                ...(comment !== undefined ? { comment } : {}),
                ...(MappingOptions !== undefined ? { MappingOptions } : {}),
                editedBy
            })
                .then(() => res.send(record))
                .catch((err) => res.status(400).send(err));
        });
};

const createOption = (req, res) => {
    const recordId = parseInt(req.params.recordId);
    const { mappingOptionId, mappingQuestionId } = req.body;
    return db.RecordMappingOption.create({
        recordId,
        mappingQuestionId,
        mappingOptionId
    })
        .then(() => {
            db.MappingOption.findByPk(mappingOptionId)
                .then(option => res.send(option))
                .catch(err => res.status(400).send(err))
        })
        .catch((err) => res.status(400).send(err));
};

const removeOption = (req, res) => {
    const mappingOptionId = parseInt(req.params.mappingOptionId);
    const recordId = parseInt(req.params.recordId);
    return db.RecordMappingOption.destroy({
        where: { mappingOptionId, recordId }
    }).then((option) => {
        res.send(`${mappingOptionId} deleted successfully`);
    }).catch(err => res.status(400).send(err));
};

module.exports = {
    listing,
    get,
    update,
    createOption,
    removeOption
};
